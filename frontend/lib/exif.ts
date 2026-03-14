/**
 * Extract GPS coordinates from a JPEG/TIFF image's EXIF data.
 *
 * Pure TypeScript implementation — no external dependencies.
 * Supports JPEG (0xFFD8) with APP1 EXIF segments.
 */

export type GpsCoords = {
  latitude: number;
  longitude: number;
};

/**
 * Read GPS lat/lng from an image File's EXIF metadata.
 * Returns null if no EXIF GPS data is found.
 */
export async function extractGpsFromExif(file: File): Promise<GpsCoords | null> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  // Check JPEG marker
  if (view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset < view.byteLength - 1) {
    const marker = view.getUint16(offset);

    // APP1 = EXIF
    if (marker === 0xffe1) {
      const length = view.getUint16(offset + 2);
      const exifStart = offset + 4;

      // Check "Exif\0\0" header
      const exifHeader =
        String.fromCharCode(view.getUint8(exifStart)) +
        String.fromCharCode(view.getUint8(exifStart + 1)) +
        String.fromCharCode(view.getUint8(exifStart + 2)) +
        String.fromCharCode(view.getUint8(exifStart + 3));

      if (exifHeader !== "Exif") return null;

      const tiffStart = exifStart + 6;
      return parseTiffForGps(view, tiffStart);
    }

    // Skip other markers
    if ((marker & 0xff00) === 0xff00) {
      const segLength = view.getUint16(offset + 2);
      offset += 2 + segLength;
    } else {
      break;
    }
  }

  return null;
}

function parseTiffForGps(view: DataView, tiffStart: number): GpsCoords | null {
  // Byte order
  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 0x4949; // "II"

  const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const ifd0Start = tiffStart + ifdOffset;

  // Find GPS IFD pointer in IFD0
  const gpsIfdOffset = findTagValue(view, ifd0Start, tiffStart, littleEndian, 0x8825);
  if (gpsIfdOffset === null) return null;

  const gpsIfdStart = tiffStart + gpsIfdOffset;
  return parseGpsIfd(view, gpsIfdStart, tiffStart, littleEndian);
}

function findTagValue(
  view: DataView,
  ifdStart: number,
  tiffStart: number,
  le: boolean,
  targetTag: number
): number | null {
  try {
    const numEntries = view.getUint16(ifdStart, le);
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = ifdStart + 2 + i * 12;
      const tag = view.getUint16(entryOffset, le);
      if (tag === targetTag) {
        return view.getUint32(entryOffset + 8, le);
      }
    }
  } catch {
    return null;
  }
  return null;
}

function parseGpsIfd(
  view: DataView,
  ifdStart: number,
  tiffStart: number,
  le: boolean
): GpsCoords | null {
  let latRef = "N";
  let lonRef = "E";
  let latRational: number[] | null = null;
  let lonRational: number[] | null = null;

  try {
    const numEntries = view.getUint16(ifdStart, le);
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = ifdStart + 2 + i * 12;
      const tag = view.getUint16(entryOffset, le);
      const type = view.getUint16(entryOffset + 2, le);
      const count = view.getUint32(entryOffset + 4, le);
      const valueOffset = view.getUint32(entryOffset + 8, le);

      switch (tag) {
        case 1: // GPSLatitudeRef
          latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
          break;
        case 2: // GPSLatitude (3 rationals)
          latRational = readRationals(view, tiffStart + valueOffset, 3, le);
          break;
        case 3: // GPSLongitudeRef
          lonRef = String.fromCharCode(view.getUint8(entryOffset + 8));
          break;
        case 4: // GPSLongitude (3 rationals)
          lonRational = readRationals(view, tiffStart + valueOffset, 3, le);
          break;
      }
    }
  } catch {
    return null;
  }

  if (!latRational || !lonRational) return null;

  let latitude = latRational[0] + latRational[1] / 60 + latRational[2] / 3600;
  let longitude = lonRational[0] + lonRational[1] / 60 + lonRational[2] / 3600;

  if (latRef === "S") latitude = -latitude;
  if (lonRef === "W") longitude = -longitude;

  // Sanity check
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return { latitude, longitude };
}

function readRationals(view: DataView, offset: number, count: number, le: boolean): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const num = view.getUint32(offset + i * 8, le);
    const den = view.getUint32(offset + i * 8 + 4, le);
    values.push(den === 0 ? 0 : num / den);
  }
  return values;
}

/**
 * Format coordinates for display: "-6.7920°, 39.2080°"
 */
export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
}
