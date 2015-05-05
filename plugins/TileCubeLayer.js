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
                  self._render(element, tileJson, id, [level,c,r].join(''), function(){
                    callback(null, null);
                  });  
                } catch(e) {
                  callback(null, null);
                }
              }, 25);
            }, id);
           // for saving data, store the tile and layers
           // self._tileData[id] = {
           //   layers: layers,
           //   tile: tile
           // }
            //self._render(element, tile, id, function(){
            //});
          } catch(e){
             
          }
        }
      });
    //} else {
    //  self._render(element, this._tileData[id].layers, this._tileData[id].tile, function(){});
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

  refreshStyles: function( styles ){
    this.styles = styles;
    for (var id in this._tileData){
      this._render( this._tileDom[id], this._tileData[id].tile, function(){} );
    }
  },

  _render: function(canvas, tile, id, tileid, callback){
    var start = Date.now();
    var self = this;
    var context = canvas.getContext('2d');
    var width = canvas.width, height=canvas.height;
    console.log(width, height);
    //context.clearRect(0, 0, width, height);

    for (var time in tile){
      if (this.hidpi) {
        width *= (1/window.devicePixelRatio);
        height *= (1/window.devicePixelRatio);
      }

      // parse the renderer into a fill
      for (var i = 0; i < tile[time].length; i++){
        //console.log(tile[time][i])
        this._renderPoint( tile[time][i], context, tileid ); 
      }
    }
    this._tilePerf[id] = (Date.now() - start);
    callback();

  },

  _renderPoint: function(point, context, tileid){
    context.lineWidth = 1;
    context.fillStyle = 'rgb(100,100,100)';
    context.strokeStyle = 'rgb(200,200,200)';

    var x = point.x;
    var y = point.y;
    /*var size = 256;
    if ( this.hidpi ){
      size = size * window.devicePixelRatio;
    }
    x = x/4096*size;
    y = y/4096*size;
    if ( this.hidpi ) {
      x *= (1/window.devicePixelRatio);
      y *= (1/window.devicePixelRatio);
    }*/
    context.beginPath();
    context.arc(x, y, 2, 0, 2 * Math.PI, true);
    context.fill();
    context.stroke();
  }


});

if (has("extend-esri")) {
  lang.setObject("layers.PbfTileLayer", PbfTileLayer, esriNS);
}

return PbfTileLayer;  
});
