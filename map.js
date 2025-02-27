// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
let timeFilter = -1;

let tripData; 
let stations; 
let radiusScale; 
let circles; 
mapboxgl.accessToken = 'pk.eyJ1IjoicGF2aXNhbmR5MSIsImEiOiJjbTdtczZpdzAwbHVpMmpxNDdrZHNra2g2In0.yobVno0aqEuOjmPGachfPA';


const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18
});

map.on('load', async () => {

  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
  });

  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': 'green',
      'line-width': 3,
      'line-opacity': 0.4
    }
  });


  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': 'green',
      'line-width': 3,
      'line-opacity': 0.4
    }
  });


  try {
    const jsonUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    

    const jsonData = await d3.json(jsonUrl);
    

    stations = jsonData.data.stations;
    
    console.log('Loaded JSON Data:', jsonData);
    console.log('Stations Array:', stations);
    console.log('Sample station structure:', stations[0]);



  try {

    const tripsUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
    

    tripData = await d3.csv(
      tripsUrl,
      (trip) => {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);
        return trip;
      }
    );
    
    console.log(`Loaded ${tripData.length} trips`);
    console.log('Sample trip data:', tripData[0]);
    

    stations = computeStationTraffic(stations, tripData);
  } catch (error) {
    console.error('Error fetching trip data:', error);
  }

  const departures = d3.rollup(
    tripData,
    (v) => v.length,  
    (d) => d.start_station_id  
  );


  const arrivals = d3.rollup(
    tripData,
    (v) => v.length,  
    (d) => d.end_station_id  
  );


  stations = stations.map((station) => {
    let id = station.station_id;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });

  console.log("Traffic calculation complete");
  console.log("Sample station with traffic:", stations[0]);


    function getCoords(station) {

      const lon = station.lon || station.Long || station.longitude || 0;
      const lat = station.lat || station.Lat || station.latitude || 0;
      

      if (!lon || !lat || isNaN(+lon) || isNaN(+lat)) {
        console.warn('Invalid coordinates for station:', station);
        return { cx: 0, cy: 0 }; 
      }
      
      const point = new mapboxgl.LngLat(+lon, +lat);
      const { x, y } = map.project(point);
      return { cx: x, cy: y };
    }


    const svg = d3.select('#map').select('svg');

    const radiusScale = d3
    .scaleSqrt()  
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);  


    const circles = svg.selectAll('circle')
      .data(stations)
      .enter()
      .append('circle')
      .attr('r', d => radiusScale(d.totalTraffic))
      .attr('fill', 'steelblue')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('opacity', 0.6)
      .each(function(d) {
        // Add <title> for browser tooltips
        d3.select(this)
          .append('title')
          .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
      });
    function updatePositions() {
      circles
        .attr('cx', d => getCoords(d).cx)  
        .attr('cy', d => getCoords(d).cy); 
    }


    updatePositions();


    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);

  } catch (error) {
    console.error('Error loading JSON:', error);
  }

const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');



function updateTimeDisplay() {
  timeFilter = Number(timeSlider.value);  

  if (timeFilter === -1) {
    selectedTime.textContent = '';  
    anyTimeLabel.style.display = 'block';  
  } else {
    selectedTime.textContent = formatTime(timeFilter);  
    anyTimeLabel.style.display = 'none';  
  }


  updateScatterPlot(timeFilter);
}

function updateScatterPlot(timeFilter) {

  const filteredTrips = filterTripsbyTime(tripData, timeFilter);
  

  const filteredStations = computeStationTraffic(stations, filteredTrips);
  

  timeFilter === -1 
    ? radiusScale.range([0, 25]) 
    : radiusScale.range([3, 50]);
  

  radiusScale.domain([0, d3.max(filteredStations, d => d.totalTraffic) || 1]);
  

  circles
    .data(filteredStations, d => d.station_id)
    .join('circle')
    .attr('r', d => radiusScale(d.totalTraffic))
    .each(function(d) {
      // Update tooltip text
      d3.select(this).select('title')
        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
    });
}

// Add event listener for slider movement
timeSlider.addEventListener('input', updateTimeDisplay);

// Initialize the display
updateTimeDisplay();
});

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
  return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

// Helper function to get minutes since midnight from a Date object
// Helper function to get minutes since midnight from a Date object
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Helper function to compute station traffic
function computeStationTraffic(stations, tripData) {
  // Calculate departures (trips starting at each station)
  const departures = d3.rollup(
    tripData,
    (v) => v.length,
    (d) => d.start_station_id
  );

  // Calculate arrivals (trips ending at each station)
  const arrivals = d3.rollup(
    tripData,
    (v) => v.length,
    (d) => d.end_station_id
  );

  // Add traffic data to each station
  return stations.map((station) => {
    let id = station.station_id;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}

// Helper function to filter trips by time
function filterTripsbyTime(tripData, timeFilter) {
  return timeFilter === -1 
    ? tripData // If no filter is applied (-1), return all trips
    : tripData.filter((trip) => {
        // Convert trip start and end times to minutes since midnight
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);
        
        // Include trips that started or ended within 60 minutes of the selected time
        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
    });
}