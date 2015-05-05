define(
[
  "dojo/_base/declare",
  "dojo/_base/connect",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/_base/url",
  "dojo/dom-construct",
  "dojo/dom-class",
  "dojo/dom-geometry",
  "dojo/dom-style",
  "dojox/collections/ArrayList",
  "dojox/gfx/matrix",
  "dojo/has",
  "dojo/string",
  
  "esri/kernel",
  "esri/request",
  "esri/urlUtils",
  "esri/tileUtils",
  "esri/SpatialReference",
  "esri/geometry/Extent",
  "esri/geometry/Rect",
  
  "esri/layers/TiledMapServiceLayer",
  "esri/layers/TileInfo"
],
function(
  declare, connection, lang, array, Url, domConstruct, domClass, domGeom, domStyle,
  ArrayList, gfxMatrix, has, string,
  esriNS, esriRequest, urlUtils, tileUtils, SpatialReference, Extent, Rect,
  TiledMapServiceLayer, TileInfo
) {

var VectorTileLayer = declare(TiledMapServiceLayer, {
  declaredClass: "esri.layers.VectorTileLayer",
  
  constructor: function ( /*string*/ urlTemplate, /*Object?*/ options) {
    if (!options) {
      options = {};
    }
    
    this.urlTemplate = urlTemplate;
    this.options = options;
    this.hidpi = options.hidpi;
    this.styles = options.styles;

    var initialExt = new Extent(-20037508.342787, -20037508.342780, 20037508.342780, 20037508.342787, new SpatialReference({ wkid:102100 }));
    var fullExt = new Extent(-20037508.342787, -20037508.342780, 20037508.342780, 20037508.342787, new SpatialReference({ wkid:102100 }));
    //if initial extent/full extent is not specified in the options,
    //the default ones covers the world area
    this.initialExtent = options.initialExtent || initialExt;
    this.fullExtent = options.fullExtent || fullExt;
    //users can set tileInfo through options.
    //if not provided, it applies a default tileInfo
    if (options.tileInfo) {
      this.tileInfo = options.tileInfo;
    }
    else {
      var lods = [{ "level": 0, "resolution": 156543.033928, "scale": 591657527.591555 },
                  { "level": 1, "resolution": 78271.5169639999, "scale": 295828763.795777 },
                  { "level": 2, "resolution": 39135.7584820001, "scale": 147914381.897889 },
                  { "level": 3, "resolution": 19567.8792409999, "scale": 73957190.948944 },
                  { "level": 4, "resolution": 9783.93962049996, "scale": 36978595.474472 },
                  { "level": 5, "resolution": 4891.96981024998, "scale": 18489297.737236 },
                  { "level": 6, "resolution": 2445.98490512499, "scale": 9244648.868618 },
                  { "level": 7, "resolution": 1222.99245256249, "scale": 4622324.434309 },
                  { "level": 8, "resolution": 611.49622628138, "scale": 2311162.217155 },
                  { "level": 9, "resolution": 305.748113140558, "scale": 1155581.108577 },
                  { "level": 10, "resolution": 152.874056570411, "scale": 577790.554289 },
                  { "level": 11, "resolution": 76.4370282850732, "scale": 288895.277144 },
                  { "level": 12, "resolution": 38.2185141425366, "scale": 144447.638572 },
                  { "level": 13, "resolution": 19.1092570712683, "scale": 72223.819286 },
                  { "level": 14, "resolution": 9.55462853563415, "scale": 36111.909643 },
                  { "level": 15, "resolution": 4.77731426794937, "scale": 18055.954822 },
                  { "level": 16, "resolution": 2.38865713397468, "scale": 9027.977411 },
                  { "level": 17, "resolution": 1.19432856685505, "scale": 4513.988705 },
                  { "level": 18, "resolution": 0.597164283559817, "scale": 2256.994353 },
                  { "level": 19, "resolution": 0.298582141647617, "scale": 1128.497176 }
                ];
      var tileInfo = new TileInfo({
        "rows": 256,
        "cols": 256,
        "origin": {
          "x": -20037508.342787,
          "y": 20037508.342787
        },
        "spatialReference": {
          "wkid": 102100
        },
        "lods": lods
      });
      this.tileInfo = tileInfo;
    }    
  
    this.spatialReference = new SpatialReference(this.tileInfo.spatialReference.toJson());
    this.copyright = options.copyright || "";
    
    var url = new Url(urlTemplate);
  
    if (url.scheme){ 
      var tileServer = url.scheme + "://" + url.authority + "/";
      this.urlPath = urlTemplate.substring(tileServer.length);    
      this.tileServers = options.tileServers || [];
      if (url.authority.indexOf("{subDomain}") === -1) {
        this.tileServers.push(tileServer);
      }
    } else {
      var locationParts = location.href.split('/');
      var file = locationParts.pop();
      var tileServer = locationParts.join('/');
      this.urlPath = urlTemplate;
      this.tileServers = options.tileServers || [];
      this.tileServers.push(tileServer);
    }
    //if subDomains parameter is provided.    
    /*if (options.subDomains && options.subDomains.length > 0 && url.authority.split(".").length > 1) {
      this.subDomains = options.subDomains;
      var subDomainTileServer;
      array.forEach(options.subDomains, function(subDomain, idx){
        if (url.authority.indexOf("${subDomain}") > -1) {
          subDomainTileServer = url.scheme + "://" + string.substitute(url.authority, {subDomain: subDomain}) + "/";
        }
        else if (url.authority.indexOf("{subDomain}") > -1) {
          subDomainTileServer = url.scheme + "://" + url.authority.replace(/\{subDomain\}/gi, subDomain) + "/";
        }        
        this.tileServers.push(subDomainTileServer);        
      }, this);
    }*/
    
    this.tileServers = array.map(this.tileServers, function(item){ 
      if (item.charAt(item.length - 1) !== "/") {
        item += "/";
      }
      return item;
    });

    
    this._levelToLevelValue = [];
    array.forEach(this.tileInfo.lods, function(item){
      this._levelToLevelValue[item.level] = item.levelValue || item.level;
    }, this);

    // object to save tile data, to reuse data
    this._tileData = {};
    this._tileDom = {};

    this.loaded = true;
    this.onLoad(this);

  },

  getTileUrl: function (level, row, col) {
    level = this._levelToLevelValue[level];
    
    var tileUrl = this.tileServers[row % this.tileServers.length] + 
      string.substitute(
        this.urlPath, 
        {
          level: level, 
          col: col, 
          row: row
        }
      );
    
    tileUrl = tileUrl.replace(/\{level\}/gi, level)
      .replace(/\{row\}/gi, row)
      .replace(/\{col\}/gi, col);
    
    tileUrl = this.addTimestampToURL(tileUrl);
    
    return urlUtils.addProxy(tileUrl);
  },


  // override this method to create canvas elements instead of img
  _addImage: function(level, row, r, col, c, id, tileW, tileH, opacity, tile, offsets){
    var self = this;
    tileW = 256;
    tileH = 256;

    var canvas = domConstruct.create("canvas"),
      dc = connection.connect;

    this._tiles[id] = this._tileDom[id] = canvas;

    canvas.id = id;
    domClass.add(canvas, "layerTile");

    var left = (tileW * col) - offsets.x, top = (tileH * row) - offsets.y,
        map = this._map, names = esriNS._css.names,
        css = {
          width: tileW + "px",
          height: tileH + "px"
        };

    canvas.width = tileW;
    canvas.height = tileH;

    if (map.navigationMode === "css-transforms") {
      css[names.transform] = esriNS._css.translate(left, top);
      domStyle.set(canvas, css);

      canvas._left = left;
      canvas._top = top;
      domStyle.set(canvas, css);
    }

    canvas._onload_connect = dc(canvas, "onload", this, "_tileLoadHandler");
    canvas._onerror_connect = dc(canvas, "onerror", lang.hitch(this, "_tileErrorHandler", r, c));
    canvas._onabort_connect = dc(canvas, "onabort", this, "_tileAbortHandler");

    if (map.navigationMode === "css-transforms") {
      this._active.appendChild(canvas);
    }
    else {
      this._div.appendChild(canvas);
    }

    // implemented by subclasses
    this._loadTile(id, level, r, c, canvas);

  },

  refreshStyles: function( styles ){
  },

  
  _loadTile: function(level, r, c, canvas){
  },


  _render: function(element, data, tile, callback){
  },

  _asyncLoop: function(iterations, func, callback) {
    var index = 0;
    var done = false;
    var loop = {
        next: function() {
            if (done) {
                return;
            }

            if (index < iterations) {
                index++;
                func(loop);

            } else {
                done = true;
                callback();
            }
        },

        iteration: function() {
            return index - 1;
        },

        break: function() {
            done = true;
            callback();
        }
    };
    loop.next();
    return loop;
  },

  _applyStyle: function(style, layer, context){
    var self = this, feature;
    var cnt = 0;
    var renderer = style.renderer;
    var z = this._map.getZoom();
    if (style.minZoom && style.maxZoom && (z <= style.maxZoom && z >= style.minZoom)){

      if (renderer.type == 'simple'){

        self._asyncLoop(layer.length, function(loop) {
          feature = layer.feature(loop.iteration()); 
          self[ renderer.symbol.type ]( feature, context, renderer, function(){
            cnt++; 
            loop.next();
          })},
          // final callback;
          function(){
            console.log(cnt);
          }
        );

      } else if ( renderer.type == 'uniqueValue' ){

        var field = renderer.field1;
        var i = 0;
        self._asyncLoop(layer.length, function(loop) {
            i = loop.iteration();
            feature = layer.feature(i);
            var val = feature.properties[field];

            renderer.uniqueValueInfos.forEach( function(uniqStyle ){
              if ( val 
                && ( (Array.isArray(uniqStyle.value) && uniqStyle.value.indexOf(val) != -1) 
                || val == uniqStyle.value)) {

                self[uniqStyle.symbol.type]( feature, context, uniqStyle, function(){});

              } else {
                // apply default symbol
                if (!feature._drawn && renderer.defaultSymbol){
                  self[renderer.defaultSymbol.type]( feature, context, { symbol: renderer.defaultSymbol }, function(){
                  });
                }
              }
            });
            loop.next();
          }, function(){}
        );
       
      } else if (renderer.type == 'classBreaks'){
        var field = renderer.field;
        /*self._asyncLoop(layer.length, function(loop) {
            i = loop.iteration();
            feature = layer.feature(i);
            var val = feature.properties[field];
            renderer.classBreakInfos.forEach( function( classStyle ){
              if (feature.properties[field] <= classStyle.classMaxValue && !feature._drawn ){
                //self[ classStyle.symbol.type ]( feature, context, classStyle, function(){
                  cnt++; 
                  loop.next();
                //});
              }
            });
            loop.next();
          }, function(){
            console.log(cnt++, layer.length);
          }
        );*/
        layer._features.forEach(function( f,i ){
          feature = layer.feature(i);
          renderer.classBreakInfos.forEach( function( classStyle ){
            if (feature.properties[field] <= classStyle.classMaxValue && !feature._drawn ){
              if (renderer.visualVariables){
                classStyle.visualVariables = renderer.visualVariables;
              }
              self[ classStyle.symbol.type]( feature, context, classStyle, function(){} );
            }
          });
        });
      }
    }
    
  },

  esriSFS: function(feature, context, style, callback){

    var size = 256;
    if ( this.hidpi ){
      size = size * window.devicePixelRatio;
    }

    context.fillStyle = this._colorInfo( feature, style );
    //context.fillStyle = 'rgba('+style.symbol.color.join(',')+')';

    if (style.symbol.outline.width){
      context.strokeStyle = 'rgba('+style.symbol.outline.color.join(',')+')';
      context.lineWidth = style.symbol.outline.width;
    }

    //console.log('rgba('+style.symbol.color.join(',')+')');
    context.beginPath();
    this._drawFeature(feature, context, size);
    context.closePath();

    context.fill();
    if (style.symbol.outline.width) {
      context.stroke();
    }
    feature._drawn = true;
    return callback();
  },

  esriSLS: function( feature, context, style, callback ){
    context.strokeStyle = 'rgba('+style.symbol.color.join(',')+')';
    context.lineWidth = style.symbol.width;
    if (style.symbol.style && style.symbol.style == 'esriSLSDashed'){
      context.setLineDash([5]);
    } else {
      context.setLineDash([0]);
    }
    context.beginPath();

    var size = 256;
    if ( this.hidpi ){
      size = size * window.devicePixelRatio;
    }

    var geom = feature.loadGeometry();
    for (var r=0; r < geom.length; r++) {
        var ring = geom[r];
        for (var c=0; c < ring.length; c++) {
        
            var x = Math.floor(ring[c].x/4096*size),
              y = Math.floor(ring[c].y/4096*size);
            if (this.hidpi){
              x *= (1/window.devicePixelRatio);
              y *= (1/window.devicePixelRatio);
            }

            if (c == 0){
              context.moveTo(x,y);
            } else {
              context.lineTo(x,y);
            }
        }
    }

    context.stroke();
    feature._drawn = true;
    return callback();
  },

  esriSMS: function( feature, context, style, callback ){

    context.lineWidth = style.symbol.outline.width;
    context.fillStyle = this._colorInfo( feature, style );
    context.strokeStyle = 'rgba('+style.symbol.outline.color.join(',')+')';

    var geom = feature.loadGeometry();

    var x = geom[0][0].x;
    var y = geom[0][0].y;
    var size = 256;
    if ( this.hidpi ){
      size = size * window.devicePixelRatio;
    }
    x = x/4096*size;
    y = y/4096*size;
    if ( this.hidpi ) {
      x *= (1/window.devicePixelRatio);
      y *= (1/window.devicePixelRatio);
    }
    context.beginPath();
    context.arc(x, y, this._sizeInfo(feature, style, 'size'), 0, 2 * Math.PI, true);
    context.fill();
    context.stroke();
    feature._drawn = true;

    /*if (style.labelField && feature.properties[style.labelField]){
      context.font = "12px 'Open Sans'";
      context.fillStyle = '#555';
      context.fillText(feature.properties[style.labelField], x+5, y-1);
    }*/

    return callback();
  },

  _drawFeature: function(feature, context, size){
    var geom = feature.loadGeometry();
    for (var r=0; r < geom.length; r++) {
        var ring = geom[r];
        for (var c=0; c < ring.length; c++) {
            var x = Math.floor(ring[c].x/4096*size),
              y = Math.floor(ring[c].y/4096*size);

            if (this.hidpi){
              x *= (1/window.devicePixelRatio);
              y *= (1/window.devicePixelRatio);
            }

            if (c == 0){
              context.moveTo(x,y);
            } else {
              context.lineTo(x,y);
            }
        }
    }
  },

  _colorInfo: function( feature, style){
    var color = 'rgba('+style.symbol.color.join(',')+')';
    if (style.visualVariables){
      style.visualVariables.forEach(function(vizVar){
        if (vizVar.type == "colorInfo" && feature.properties[vizVar.field]){
          var val = feature.properties[vizVar.field];
          for (var s = 1; s < vizVar.stops.length; s++){
            if (val > vizVar.stops[s-1].value && val < vizVar.stops[s].value){
              color = 'rgba('+vizVar.stops[s-1].color.join(',')+')';
            } else {
              //console.log(vizVar.stops[s-1].value, val, vizVar.stops[s].value);
            }
          }
        }
      });
    }
    return color;
  },

  _sizeInfo: function(feature, style, prop){
    var size = style.symbol[prop];
    if (style.visualVariables){
      style.visualVariables.forEach(function(vizVar){
        if (vizVar.type == "sizeInfo" && feature.properties[vizVar.field]){
          var val = feature.properties[vizVar.field];
          if (val <= vizVar.maxDataValue && val >= vizVar.minDataValue){
            size = Math.floor(( (vizVar.minSize + ((val/vizVar.maxDataValue)*vizVar.maxSize)) || vizVar.minSize ));
          } else {
            size = 0;
          }
        }
      });
    }
    return size;
  },

  _colorToHex: function(color){
    return (color && color.length === 4) ? "#" +
      ("0" + parseInt(color[0],10).toString(16)).slice(-2) +
      ("0" + parseInt(color[1],10).toString(16)).slice(-2) +
      ("0" + parseInt(color[2],10).toString(16)).slice(-2) : '';
  },

  _errorHandlerVector: function(){
    console.error('ERROR', arguments);
  }

});

if (has("extend-esri")) {
  lang.setObject("layers.VectorTileLayer", VectorTileLayer, esriNS);
}

return VectorTileLayer;  
});
