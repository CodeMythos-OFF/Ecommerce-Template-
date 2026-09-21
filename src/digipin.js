const DIGIPIN_GRID = [
  ["F", "C", "9", "8"],
  ["J", "3", "2", "7"],
  ["K", "4", "5", "6"],
  ["L", "M", "P", "T"],
];

const BOUNDS = { minLat: 2.5, maxLat: 38.5, minLon: 63.5, maxLon: 99.5 };

export const encodeDigipin = (lat, lon) => {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Invalid coordinates");
  if (latitude < BOUNDS.minLat || latitude > BOUNDS.maxLat ||
      longitude < BOUNDS.minLon || longitude > BOUNDS.maxLon) {
    throw new Error("Location is outside the DIGIPIN coverage area");
  }

  let minLat = BOUNDS.minLat, maxLat = BOUNDS.maxLat;
  let minLon = BOUNDS.minLon, maxLon = BOUNDS.maxLon;
  let digipin = "";

  for (let level = 1; level <= 10; level += 1) {
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;
    let row = 3 - Math.floor((latitude - minLat) / latDiv);
    let col = Math.floor((longitude - minLon) / lonDiv);
    row = Math.max(0, Math.min(row, 3));
    col = Math.max(0, Math.min(col, 3));
    digipin += DIGIPIN_GRID[row][col];
    maxLat = minLat + latDiv * (4 - row);
    minLat = minLat + latDiv * (3 - row);
    minLon = minLon + lonDiv * col;
    maxLon = minLon + lonDiv;
  }
  return digipin;
};
