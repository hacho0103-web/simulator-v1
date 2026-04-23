/**
 * Overpass API에서 해외 구역 건물 데이터를 GeoJSON으로 저장
 * 사용법: node scripts/fetch-district.js [marunouchi|hafencity]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DISTRICTS = {
  marunouchi: {
    bbox: '35.677,139.759,35.686,139.769', // s,w,n,e
    output: path.join(__dirname, '../public/marunouchi.geojson'),
  },
  hafencity: {
    bbox: '53.536,9.984,53.546,10.004', // s,w,n,e
    output: path.join(__dirname, '../public/hafencity.geojson'),
  },
};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function overpassToGeoJSON(data) {
  const features = data.elements
    .filter(el => el.type === 'way' && el.geometry && el.geometry.length >= 3)
    .map(el => ({
      type: 'Feature',
      properties: {
        building: el.tags?.building || 'yes',
        name: el.tags?.name || el.tags?.['name:en'] || '',
        'building:levels': el.tags?.['building:levels']
          ? parseInt(el.tags['building:levels'])
          : null,
        height: el.tags?.height
          ? parseFloat(el.tags.height)
          : null,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [el.geometry.map(pt => [pt.lon, pt.lat])],
      },
    }));

  return { type: 'FeatureCollection', features };
}

async function main() {
  const district = process.argv[2];
  if (!DISTRICTS[district]) {
    console.error('Usage: node scripts/fetch-district.js [marunouchi|hafencity]');
    process.exit(1);
  }

  const { bbox, output } = DISTRICTS[district];
  const query = `[out:json][timeout:60];way["building"](${bbox});out geom tags;`;
  const servers = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  let raw;
  for (const server of servers) {
    try {
      console.log(`Fetching from ${server}...`);
      raw = await get(`${server}?data=${encodeURIComponent(query)}`);
      break;
    } catch (e) {
      console.warn(`Failed: ${e.message}`);
    }
  }

  if (!raw) { console.error('All servers failed.'); process.exit(1); }

  const data = JSON.parse(raw);
  const geojson = overpassToGeoJSON(data);
  fs.writeFileSync(output, JSON.stringify(geojson));
  console.log(`✓ ${district}: ${geojson.features.length}개 건물 → ${output}`);

  const withLevels = geojson.features.filter(f => f.properties['building:levels']).length;
  const withHeight = geojson.features.filter(f => f.properties.height).length;
  console.log(`  층수 있음: ${withLevels}개 / 높이 있음: ${withHeight}개`);
}

main().catch(e => { console.error(e); process.exit(1); });
