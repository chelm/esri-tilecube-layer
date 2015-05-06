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
  
  "plugins/VectorTileLayer",
  "queue"
],
function(
  declare, connection, lang, array, Url, domConstruct, domClass, domGeom, domStyle,
  ArrayList, gfxMatrix, has, string,
  esriNS, esriRequest, urlUtils, tileUtils, SpatialReference, Extent, Rect,
  VectorTileLayer, queue
) {

var PbfTileLayer = declare(VectorTileLayer, {
  declaredClass: "esri.layers.TileCubeLayer",
  
  constructor: function ( urlTemplate, options) {
    this.inherited(arguments);
    this.tileQ = queue(4);
    this.temporal = (options.temporal === false) ? false : true;
    this.timeIndex = options.startTime || 10;
    this.style = options.style; 

    this.sprites = {};
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
    var _xhr = new XMLHttpRequest();
    _xhr.open( "GET", url, true );
    _xhr.responseType = "application/json";
    _xhr.onload = function( evt ) {
      try { 
        var json = JSON.parse(_xhr.response);
        var tile = {};
        for (var i=0; i < json.length; i++){
          var pixel = json[i];
          for (var j=0; j < pixel.t.length; j++){
            if (!tile[pixel.t[j]]){
              tile[pixel.t[j]] = []
            }
            tile[pixel.t[j]].push({
              x: pixel.x,
              y: pixel.y,
              v: pixel.v[j]
            });
          }
        }
        if ( json ) {
          callback(null, tile); 
        }
      } catch(e){
        //console.log(e);
      }
     }
     _xhr.send(null);
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
      var time = self.timeIndex;
      console.time('loop and render point');
      for (var t = 0; t < time; t++){
        if ( tile[t] ) {
          for (var i = 0; i < tile[t].length; i++){
            this._renderPoint( tile[t][i], context);
          }
        }
      }
      console.timeEnd('loop and render point');
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
    //console.log('render', point)
    var x = point.x;
    var y = point.y;

    if ( !this.sprites[point.v] ) {
      this._generateSprite(point);
    }
    
    //console.log('xy', x,y);
    context.drawImage(this.sprites[point.v], x, y);
  },

  _generateSprite: function(point) {
    //console.log('ok', point.v)
    var style = this.style(parseInt(point.v));
    var canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    var context = canvas.getContext('2d');
    var centerX = canvas.width / 2;
    var centerY = canvas.height / 2;
    var radius = 5;

    context.beginPath();
    context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    context.fillStyle = style.fillStyle || 'rgb(100,100,125)';
    context.fill();
    context.lineWidth = style.lineWidth || 0.8;
    context.strokeStyle = style.strokeStyle || 'rgb(240,240,240)';
    context.stroke();
    
    this.sprites[point.v] = canvas;
    console.log('sprites', this.sprites);
  }


});

if (has("extend-esri")) {
  lang.setObject("layers.PbfTileLayer", PbfTileLayer, esriNS);
}

return PbfTileLayer;  
});
