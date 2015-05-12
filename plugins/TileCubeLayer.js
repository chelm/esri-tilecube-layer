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
  
  "plugins/CanvasTileLayer",
  "queue"
],
function(
  declare, connection, lang, array, Url, domConstruct, domClass, domGeom, domStyle,
  ArrayList, gfxMatrix, has, string,
  esriNS, esriRequest, urlUtils, tileUtils, SpatialReference, Extent, Rect,
  CanvasTileLayer, queue
) {

var TileCubeLayer = declare(CanvasTileLayer, {
  declaredClass: "esri.layers.TileCubeLayer",
  
  constructor: function ( urlTemplate, options) {
    var self = this;
    this.tileQ = queue(4);
    this.tileQ.awaitAll(function() { 
      self.emit('tiles-loaded', this);
    });
    this.temporal = (options.temporal === false) ? false : true;
    this.startTime = options.startTime || 0;
    this.endTime = options.endTime || 10;
    this.style = options.style; 
    this.cumulative = options.cumulative;
    this.buffer = options.buffer || 20; 

    this.sprites = {};
    //this.inherited(arguments);
  },

  // override this method to create canvas elements instead of img
  _addImage: function(level, row, r, col, c, id, tileW, tileH, opacity, tile, offsets){
    this.inherited(arguments);
  },

  _loadTile: function(id, level, r, c, element){
    var self = this;
    //if (!this._tileData[id]){

      this._getTile(this.getTileUrl(level, r, c), function(err, tileJson){
        if (!err && tileJson){
          try {
            self.tileQ.defer(function(id, callback){
              setTimeout(function() {
                try {
                  self._render(element, tileJson, function(){
                    callback(null, null);
                  });  
                } catch(e) {
                  callback(null, null);
                }
              }, 25);
            }, id);
            // for saving data, store the tile and layers
            self._tileData[id] = tileJson;
          } catch(e){
             
          }
        }
      });
    //} else {
    //  self._render(element, this._tileData[id], function(){});
    //}
    self._loadingList.remove(id);
    self._fireOnUpdateEvent();
  },

  _getTile: function(url, callback){
    var self = this;
    var _xhr = new XMLHttpRequest();
    _xhr.open( "GET", url, true );
    _xhr.responseType = "application/json";
    _xhr.onload = function( evt ) {
      try { 
        var json = JSON.parse(_xhr.response);
        if ( json ) {
          callback(null, self._processData(json));   
        }
      } catch(e){
        //console.log(e);
      }
     }
     _xhr.send(null);
  },

  _processData: function(json, callback){
    var tile = {
      histograms: {}
    };
    for (var i=0; i < json.length; i++){
      var pixel = json[i];
      var steps = pixel.t;
      var values = pixel.v;
      var stepData = [];

      for (var j=0; j < steps.length; j++){

        var step = steps[j];
        var val = pixel.v[j];

        if (!tile.histograms[step]) {
          tile.histograms[step] = {};
        }

        if (!tile.histograms[step][val]) {
          tile.histograms[step][val] = 0;
        }
        tile.histograms[step][val]++;

        if (!tile[step]){
          tile[step] = [];
        }
 
        tile[step].push({
          x: pixel.x,
          y: pixel.y,
          v: val
        });
        
      }
    }
    return tile; //callback(null, tile);
  },

  _update: function( styles ){
    this.styles = styles;
    this.sprites = {};
    for (var id in this._tileData){
      this._render( this._tileDom[id], this._tileData[id], function(){} );
    }
  },

  _render: function(canvas, tile, callback){
    var start = Date.now();
    var self = this;
    var context = canvas.getContext('2d');
    var width = canvas.width, height=canvas.height;
    //console.log(width, height);

    context.clearRect(0, 0, width, height);

    if (this.hidpi) {
      width *= (1/window.devicePixelRatio);
      height *= (1/window.devicePixelRatio);
    }

    if ( this.temporal === true ) {
      var time = self.endTime;
      if ( this.cumulative ) {
        for (var t = this.startTime; t < time; t++){
          if ( tile[t] ) {
            for (var i = 0; i < tile[t].length; i++){
              if ( this.disabledValues ) {
                if ( this.disabledValues.indexOf(parseInt(tile[t][i].v)) === -1 ) {
                  this._renderPoint( tile[t][i], context);
                }
              } else {
                this._renderPoint( tile[t][i], context);
              }
            }
          }
        }
      } else {
        //console.log('not cumulative', tile, time);
        if ( tile[time] ) {
          for (var i = 0; i < tile[time].length; i++){
            if ( this.disabledValues ) {
              if ( this.disabledValues.indexOf(parseInt(tile[time][i].v)) === -1 ) {
                this._renderPoint( tile[time][i], context);
              }
            } else {
              this._renderPoint( tile[time][i], context);
            }
          }
        }
      }
    } else {
      
      for (var time in tile){
        // parse the renderer into a fill
        for (var i = 0; i < tile[time].length; i++){
          this._renderPoint( tile[time][i], context); 
        }
      }
    }
    callback();
  },

  _renderPoint: function(point, context){
    if ( !this.sprites[point.v] ) {
      this._generateSprite(point);
    }

    var x = parseInt(point.x);
    var y = parseInt(point.y);
    if ( this.hidpi ) {
      x *= 2;
      y *= 2;
    }

    x += this.buffer;
    y += this.buffer;
    var xOff = this.sprites[point.v].width/2;
    var yOff = this.sprites[point.v].height/2;
    //console.log(xOff, yOff)
    context.drawImage(this.sprites[point.v], x-xOff, y-yOff);    

  },

  _generateSprite: function(point) {
    var val = (isNaN(parseInt(point.v))) ? point.v : parseInt(point.v);
    var style = this.style(val);
    var r = style.radius;

    var canvas = document.createElement('canvas');
    canvas.width = style.radius * 2;
    canvas.height = style.radius * 2;
    var context = canvas.getContext('2d');

    context.arc(r, r, r, 0, 2 * Math.PI, false);
    context.fillStyle = style.fillStyle || 'rgb(100,100,125)';
    context.fill();
    context.lineWidth = style.lineWidth || 0.2;
    context.strokeStyle = style.strokeStyle || 'rgb(240,240,240)';
    context.stroke();
    context.beginPath();
    
    this.sprites[point.v] = canvas;
  }


});

if (has("extend-esri")) {
  lang.setObject("layers.TileCubeLayer", TileCubeLayer, esriNS);
}

return TileCubeLayer;  
});
