# Roadmap

## Now

- [x] 10-layer globe with ESRI satellite imagery
- [x] Live global flight aggregation (airplanes.live, no key)
- [x] Satellite orbital propagation (CelesTrak TLEs + satellite.js)
- [x] 3D cloud sprites (Cesium CloudCollection, atmospheric band distribution)
- [x] Depth shadow system for all polyline layers
- [x] Always-on tactical coastline overlay
- [x] Dark Glass/Cyber HUD with UTC clock and status dots

## Next

- [ ] Touch/gesture controls tuned for tablet (pinch zoom, swipe pan)
- [ ] Real cloud cover from NOAA GOES-16/17 WMS (replace procedural)
- [ ] Configurable refresh intervals per layer in HUD
- [ ] Layer opacity sliders
- [ ] AIS maritime tracking (MarineTraffic free tier or AISHub)
- [ ] Click-to-inspect: tap a flight/satellite point to show callsign/altitude popup

## Later

- [ ] Production build proxy (Express or Cloudflare Worker replacing Vite middleware)
- [ ] PWA manifest for add-to-homescreen on tablet
- [ ] Historical playback mode (replay last N hours of seismic/fire events)
- [ ] Custom layer plugin API (drop in a GeoJSON URL and it renders)
- [ ] Dark/light theme toggle (tactical dark is default)
