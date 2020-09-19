// ====================== Google Maps GPS Picker ======================
//
// User must replace the view and field. View contains the 'address' and 
// field is the address field in the record. 
// 
// Plugin will render a google map above the address. By default it will center
// on the current address and drop a pin there. If no current address, it will 
// center on the start lat/start lon (TODO - no, it will center on 0,0. Need to 
// add a "is lat or lon empty" conditional). Picking a point on the map will 
// update the lat/lon entry boxes
//
// TODO - untested with address-style display, only tested with lat/long entry 
// style

var START_LAT=39.043786;
var START_LON=-78.157580;
var GMAPS_KEY="YOUR KEY";

// Flag to ensure we call getScript only once
var loadedMaps = 0;

 // This is the view with the form. field_27 is the Latitude/Logitude location field
$(document).on('knack-view-render.view_2', function(event, view, data) {
    $("#kn-input-field_14").prepend('<div id="map_canvas" style="width: 100%; height: 300px;"></div>');
  
  var geocoder;
  var map, infoWindow;
  var marker;

  function initMap() {
    // If field already has lat/lon, center map on it
	var centerStartPoint = new google.maps.LatLng(START_LAT, START_LON);
    if (data.field_14_raw) {
      centerStartPoint = new google.maps.LatLng(data.field_14_raw.latitude, data.field_14_raw.longitude);
    }
    var map = new google.maps.Map(
      document.getElementById("map_canvas"), {
        center: centerStartPoint, 
        zoom: 15,
        streetViewControl: false,
        mapTypeId: 'satellite',
        mapTypeControlOptions: {
          mapTypeIds: ['satellite', 'terrain', 'roadmap', 'hybrid'],
        }

      }
    );
    
    infoWindow = new google.maps.InfoWindow;
    
    // If lat/lon already set, make a marker and zoom in
    if (data.field_14_raw) {
      marker = new google.maps.Marker({
        position: centerStartPoint,
        map: map
      });
      map.setZoom(17);
    }

    google.maps.event.addListener(map, "click", function(e) {
      latLng = e.latLng;
      $("#latitude").val(e.latLng.lat());
      $('input[name=longitude]').val(e.latLng.lng());
         
      // if marker exists and has a .setMap method, hide it
      if (marker && marker.setMap) {
      	marker.setMap(null);
      }
      marker = new google.maps.Marker({
        position: latLng,
        map: map
      });
      infoWindow.setPosition(latLng);
      infoWindow.setContent('You have selected:<br>Lat: '+ e.latLng.lat() +'<br>Long: '+e.latLng.lng());
      infoWindow.open(map,marker);
      });
  }
  
  if (!loadedMaps){
    $.getScript('https://maps.googleapis.com/maps/api/js?key=' + GMAPS_KEY).done(function() {
      loadedMaps = 1;
      initMap();
    });
  } else {
    initMap();
  }
}); 
