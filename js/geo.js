/* Loeito - free and open-source PDF workbench. Copyright (C) 2026 Ahmed Bilal and contributors. SPDX-License-Identifier: AGPL-3.0-or-later (see LICENSE) */
/* Loeito geo: coordinate systems (UTM ⇄ WGS84) and writers for GIS, Delft3D / D-Flow FM and CAD formats.
   Features: [{ name, type: 'point'|'line'|'polygon', coords: [[x,y],…], value }] in the map's own coordinates. */
(() => {
  const L = window.Loeito;
  const G = (L.geo = {});

  /* ——— Coordinate systems ——— crs = { type: 'local' | 'utm' | 'wgs84', zone, south } */
  G.crsLabel = c => c.type === 'utm' ? `UTM zone ${c.zone}${c.south ? 'S' : 'N'} (WGS 84), meters` : c.type === 'wgs84' ? 'WGS 84 longitude / latitude' : 'Local / unknown';
  G.epsg = c => c.type === 'utm' ? (c.south ? 32700 : 32600) + +c.zone : c.type === 'wgs84' ? 4326 : null;
  const GEOGCS = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  G.prj = c => {
    if (c.type === 'wgs84') return GEOGCS;
    if (c.type !== 'utm') return null;
    const cm = +c.zone * 6 - 183;
    return `PROJCS["WGS_1984_UTM_Zone_${c.zone}${c.south ? 'S' : 'N'}",${GEOGCS},PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",${c.south ? '10000000.0' : '0.0'}],PARAMETER["Central_Meridian",${cm.toFixed(1)}],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]`;
  };
  // UTM → longitude/latitude (WGS 84), Snyder's series — sub-millimetre within a zone.
  G.utmToLonLat = ([E, N], zone, south) => {
    const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    const x = E - 500000, y = south ? N - 10000000 : N;
    const M = y / k0, mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256));
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const C1 = ep2 * Math.cos(p1) ** 2, T1 = Math.tan(p1) ** 2, N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2), R1 = a * (1 - e2) / (1 - e2 * Math.sin(p1) ** 2) ** 1.5, D = x / (N1 * k0);
    const lat = p1 - (N1 * Math.tan(p1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
    const lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(p1);
    return [((+zone * 6 - 183) + lon * 180 / Math.PI), lat * 180 / Math.PI];
  };
  // longitude/latitude → UTM (used to suggest the zone and for round-trip checks)
  G.lonLatToUtm = ([lon, lat], zone) => {
    zone = zone || Math.floor((lon + 180) / 6) + 1;
    const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    const phi = lat * Math.PI / 180, lam = (lon - (zone * 6 - 183)) * Math.PI / 180;
    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2), T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, A = Math.cos(phi) * lam;
    const M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi) + (15 * e2 * e2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
    const E = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
    let Nn = k0 * (M + N * Math.tan(phi) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
    if (lat < 0) Nn += 10000000;
    return { E, N: Nn, zone, south: lat < 0 };
  };
  G.toLonLat = (c, crs) => crs.type === 'wgs84' ? c : crs.type === 'utm' ? G.utmToLonLat(c, crs.zone, crs.south) : null;
  G.canLonLat = crs => crs.type === 'wgs84' || crs.type === 'utm';

  /* ——— helpers ——— */
  const closed = cs => (cs.length && (cs[0][0] !== cs[cs.length - 1][0] || cs[0][1] !== cs[cs.length - 1][1]) ? [...cs, cs[0]] : cs);
  const signedArea = cs => { let s = 0; for (let i = 0; i < cs.length - 1; i++) s += cs[i][0] * cs[i + 1][1] - cs[i + 1][0] * cs[i][1]; return s / 2; };
  const fx = (v, geo) => (geo ? v.toFixed(8) : v.toFixed(3));
  const tekalName = (n, i, prefix) => (String(n || '').trim().replace(/\s+/g, '_').replace(/[^\w.\-]/g, '') || `${prefix}${String(i + 1).padStart(3, '0')}`);
  const header = (title, crs) => [
    '*', `* ${title}`, `* Digitized with Loeito PDF on ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
    `* Coordinate System = ${crs.type === 'wgs84' ? 'Spherical' : 'Cartesian'}${crs.type === 'utm' ? ` (UTM zone ${crs.zone}${crs.south ? 'S' : 'N'}, WGS 84)` : ''}`, '*'];
  // TEKAL block file (shared by .ldb, .pol, .pli): name line, "rows 2", then x y rows.
  function tekal(blocks, crs, title, prefix) {
    const geo = crs.type === 'wgs84', out = header(title, crs);
    blocks.forEach((b, i) => {
      out.push(tekalName(b.name, i, prefix));
      out.push(`${String(b.coords.length).padStart(5)}${'2'.padStart(5)}`);
      for (const [x, y] of b.coords) out.push(`${fx(x, geo).padStart(16)} ${fx(y, geo).padStart(16)}`);
    });
    return out.join('\r\n') + '\r\n';
  }

  /* ——— Delft3D / D-Flow FM ——— */
  // A.2 land boundary: every line, and every area as a closed polyline
  G.ldb = (feats, crs) => tekal(feats.filter(f => f.type !== 'point').map(f => ({ name: f.name, coords: f.type === 'polygon' ? closed(f.coords) : f.coords })), crs, 'Land boundary file (.ldb) — Delft3D RGFGRID / QUICKIN', 'L');
  // A.5 polygon file: first record = last record
  G.pol = (feats, crs) => tekal(feats.filter(f => f.type === 'polygon').map(f => ({ name: f.name, coords: closed(f.coords) })), crs, 'Polygon file (.pol)', 'P');
  // D-Flow FM polyline (boundaries, cross-sections, dry areas…)
  G.pli = (feats, crs) => tekal(feats.filter(f => f.type !== 'point').map(f => ({ name: f.name, coords: f.type === 'polygon' ? closed(f.coords) : f.coords })), crs, 'Polyline file (.pli) — D-Flow FM', 'pli');
  // A.3 samples: x y value for points and for every vertex of lines/areas that carry a value (e.g. depth contours)
  G.xyz = (feats, crs) => {
    const geo = crs.type === 'wgs84', rows = [];
    for (const f of feats) {
      const v = f.value; if (v === '' || v == null || !isFinite(+v)) continue;
      for (const [x, y] of f.type === 'polygon' ? f.coords : f.coords) rows.push(`${fx(x, geo)} ${fx(y, geo)} ${(+v).toPrecision(8).replace(/\.?0+$/, '')}`);
    }
    return rows.join('\r\n') + '\r\n';
  };
  G.xyzCount = feats => feats.filter(f => f.value !== '' && f.value != null && isFinite(+f.value)).reduce((a, f) => a + f.coords.length, 0);
  // D-Flow FM observation points: x y 'name'
  G.xyn = (feats, crs) => feats.filter(f => f.type === 'point').map((f, i) => `${fx(f.coords[0][0], crs.type === 'wgs84')} ${fx(f.coords[0][1], crs.type === 'wgs84')} '${String(f.name || 'Obs' + (i + 1)).replace(/'/g, '')}'`).join('\r\n') + '\r\n';

  /* ——— GIS ——— */
  G.geojson = (feats, crs, props) => {
    const fc = { type: 'FeatureCollection', features: feats.map((f, i) => ({
      type: 'Feature', properties: (p => ({ name: f.name, value: f.value === '' || f.value == null ? null : +f.value, ...(p.lengthRaw !== undefined ? { length: p.lengthRaw } : {}), ...(p.areaRaw !== '' && p.areaRaw !== undefined ? { area: p.areaRaw } : {}) }))(props ? props(f, i) : {}),
      geometry: f.type === 'point' ? { type: 'Point', coordinates: f.coords[0] } : f.type === 'line' ? { type: 'LineString', coordinates: f.coords } : { type: 'Polygon', coordinates: [closed(f.coords)] },
    })) };
    if (crs.type === 'utm') fc.crs = { type: 'name', properties: { name: `urn:ogc:def:crs:EPSG::${G.epsg(crs)}` } };
    return JSON.stringify(fc, null, 1);
  };
  const esc = s => String(s ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
  G.kml = (feats, crs, title, props) => {
    const ll = cs => cs.map(c => { const [lon, lat] = G.toLonLat(c, crs); return `${lon.toFixed(8)},${lat.toFixed(8)},0`; }).join(' ');
    const pm = (f, i) => {
      const p = props ? props(f, i) : {}, desc = [f.value !== '' && f.value != null ? `Value: ${f.value}` : '', p.length ? `Length: ${p.length}` : '', p.area ? `Area: ${p.area}` : ''].filter(Boolean).join('<br>');
      const geom = f.type === 'point' ? `<Point><coordinates>${ll(f.coords)}</coordinates></Point>`
        : f.type === 'line' ? `<LineString><tessellate>1</tessellate><coordinates>${ll(f.coords)}</coordinates></LineString>`
          : `<Polygon><outerBoundaryIs><LinearRing><coordinates>${ll(closed(f.coords))}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
      return `<Placemark><name>${esc(f.name)}</name>${desc ? `<description><![CDATA[${desc}]]></description>` : ''}<styleUrl>#${f.type}</styleUrl>${geom}</Placemark>`;
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(title)}</name>
<Style id="point"><IconStyle><color>ff156bf7</color><scale>1.1</scale></IconStyle></Style>
<Style id="line"><LineStyle><color>ff4d48e5</color><width>3</width></LineStyle></Style>
<Style id="polygon"><LineStyle><color>ffff9000</color><width>2</width></LineStyle><PolyStyle><color>4dff9000</color></PolyStyle></Style>
${feats.map(pm).join('\n')}
</Document></kml>\n`;
  };
  G.gpx = (feats, crs) => {
    const pt = (tag, c) => { const [lon, lat] = G.toLonLat(c, crs); return `<${tag} lat="${lat.toFixed(8)}" lon="${lon.toFixed(8)}"/>`; };
    const wpts = feats.filter(f => f.type === 'point').map(f => { const [lon, lat] = G.toLonLat(f.coords[0], crs); return `<wpt lat="${lat.toFixed(8)}" lon="${lon.toFixed(8)}"><name>${esc(f.name)}</name></wpt>`; });
    const trks = feats.filter(f => f.type !== 'point').map(f => `<trk><name>${esc(f.name)}</name><trkseg>${(f.type === 'polygon' ? closed(f.coords) : f.coords).map(c => pt('trkpt', c)).join('')}</trkseg></trk>`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Loeito PDF" xmlns="http://www.topografix.com/GPX/1/1">\n${[...wpts, ...trks].join('\n')}\n</gpx>\n`;
  };
  G.wkt = f => {
    const cs = c => c.map(([x, y]) => `${x} ${y}`).join(', ');
    return f.type === 'point' ? `POINT (${cs(f.coords)})` : f.type === 'line' ? `LINESTRING (${cs(f.coords)})` : `POLYGON ((${cs(closed(f.coords))}))`;
  };
  G.csv = (feats, crs, props) => {
    const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [['name', 'type', 'value', 'length', 'area', 'vertices', 'wkt']];
    feats.forEach((f, i) => { const p = props ? props(f, i) : {}; rows.push([f.name, f.type, f.value ?? '', p.lengthRaw ?? '', p.areaRaw ?? '', f.coords.length, G.wkt(f)]); });
    return '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
  };

  /* ——— AutoCAD DXF (R12, universally readable) ——— */
  G.dxf = feats => {
    const o = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
    const n = v => (+v).toFixed(6);
    for (const f of feats) {
      const layer = f.type === 'point' ? 'POINTS' : f.type === 'line' ? 'LINES' : 'AREAS';
      if (f.type === 'point') {
        const [x, y] = f.coords[0];
        o.push('0', 'POINT', '8', layer, '10', n(x), '20', n(y), '30', n(f.value || 0));
        if (f.name) o.push('0', 'TEXT', '8', 'LABELS', '10', n(x), '20', n(y), '30', '0.0', '40', '2.5', '1', String(f.name).slice(0, 250));
      } else {
        o.push('0', 'POLYLINE', '8', layer, '66', '1', '70', f.type === 'polygon' ? '1' : '0', '10', '0.0', '20', '0.0', '30', n(f.value || 0));
        for (const [x, y] of f.coords) o.push('0', 'VERTEX', '8', layer, '10', n(x), '20', n(y), '30', n(f.value || 0));
        o.push('0', 'SEQEND', '8', layer);
      }
    }
    o.push('0', 'ENDSEC', '0', 'EOF');
    return o.join('\r\n') + '\r\n';
  };

  /* ——— ESRI Shapefile ——— one .shp/.shx/.dbf/.prj/.cpg set per geometry type */
  function dbf(rows, fields) {
    const enc = new TextEncoder();
    const hlen = 32 + 32 * fields.length + 1, rlen = 1 + fields.reduce((a, f) => a + f.len, 0);
    const buf = new Uint8Array(hlen + rlen * rows.length + 1), dv = new DataView(buf.buffer), d = new Date();
    buf[0] = 0x03; buf[1] = d.getFullYear() - 1900; buf[2] = d.getMonth() + 1; buf[3] = d.getDate();
    dv.setUint32(4, rows.length, true); dv.setUint16(8, hlen, true); dv.setUint16(10, rlen, true);
    fields.forEach((f, i) => {
      const o = 32 + i * 32; enc.encode(f.name.slice(0, 10)).forEach((b, k) => { buf[o + k] = b; });
      buf[o + 11] = f.type.charCodeAt(0); buf[o + 16] = f.len; buf[o + 17] = f.dec || 0;
    });
    buf[hlen - 1] = 0x0d;
    rows.forEach((r, ri) => {
      let o = hlen + ri * rlen; buf[o++] = 0x20;
      fields.forEach(f => {
        let v = r[f.name];
        let bytes;
        if (f.type === 'N') { const s = v === '' || v == null || !isFinite(+v) ? '' : (+v).toFixed(f.dec || 0); bytes = enc.encode(s.slice(-f.len).padStart(f.len)); }
        else { bytes = enc.encode(String(v ?? '')); if (bytes.length > f.len) { let s = String(v); while (enc.encode(s).length > f.len) s = s.slice(0, -1); bytes = enc.encode(s); } const pad = new Uint8Array(f.len).fill(0x20); pad.set(bytes); bytes = pad; }
        buf.set(bytes, o); o += f.len;
      });
    });
    buf[buf.length - 1] = 0x1a;
    return buf;
  }
  function shpPair(feats, kind) {
    const type = kind === 'point' ? 1 : kind === 'line' ? 3 : 5;
    const geoms = feats.map(f => {
      let cs = f.type === 'polygon' ? closed(f.coords) : f.coords;
      if (f.type === 'polygon' && signedArea(cs) > 0) cs = cs.slice().reverse(); // outer rings run clockwise
      return cs;
    });
    const contentLen = cs => (type === 1 ? 20 : 44 + 4 + 16 * cs.length);
    const total = 100 + geoms.reduce((a, cs) => a + 8 + contentLen(cs), 0);
    const shp = new DataView(new ArrayBuffer(total)), shx = new DataView(new ArrayBuffer(100 + 8 * geoms.length));
    const all = geoms.flat(), bb = [Math.min(...all.map(c => c[0])), Math.min(...all.map(c => c[1])), Math.max(...all.map(c => c[0])), Math.max(...all.map(c => c[1]))];
    for (const [dv, len] of [[shp, total], [shx, 100 + 8 * geoms.length]]) {
      dv.setInt32(0, 9994); dv.setInt32(24, len / 2); dv.setInt32(28, 1000, true); dv.setInt32(32, type, true);
      bb.forEach((v, i) => dv.setFloat64(36 + i * 8, v, true));
    }
    let off = 100;
    geoms.forEach((cs, i) => {
      const cl = contentLen(cs);
      shx.setInt32(100 + i * 8, off / 2); shx.setInt32(104 + i * 8, cl / 2);
      shp.setInt32(off, i + 1); shp.setInt32(off + 4, cl / 2); let o = off + 8;
      shp.setInt32(o, type, true); o += 4;
      if (type === 1) { shp.setFloat64(o, cs[0][0], true); shp.setFloat64(o + 8, cs[0][1], true); }
      else {
        const b = [Math.min(...cs.map(c => c[0])), Math.min(...cs.map(c => c[1])), Math.max(...cs.map(c => c[0])), Math.max(...cs.map(c => c[1]))];
        b.forEach(v => { shp.setFloat64(o, v, true); o += 8; });
        shp.setInt32(o, 1, true); shp.setInt32(o + 4, cs.length, true); shp.setInt32(o + 8, 0, true); o += 12;
        for (const [x, y] of cs) { shp.setFloat64(o, x, true); shp.setFloat64(o + 8, y, true); o += 16; }
      }
      off += 8 + cl;
    });
    return { shp: new Uint8Array(shp.buffer), shx: new Uint8Array(shx.buffer) };
  }
  // Returns [{ name, data }] — ready to zip.
  G.shapefiles = (feats, crs, base, props) => {
    const files = [], prj = G.prj(crs);
    for (const kind of ['point', 'line', 'polygon']) {
      const fs = feats.filter(f => f.type === kind); if (!fs.length) continue;
      const stem = `${base}_${kind === 'point' ? 'points' : kind === 'line' ? 'lines' : 'polygons'}`;
      const { shp, shx } = shpPair(fs, kind);
      const fields = [{ name: 'NAME', type: 'C', len: 80 }, { name: 'VALUE', type: 'N', len: 19, dec: 6 }];
      if (kind !== 'point') fields.push({ name: 'LENGTH', type: 'N', len: 19, dec: 4 });
      if (kind === 'polygon') fields.push({ name: 'AREA', type: 'N', len: 19, dec: 4 });
      const rows = fs.map((f, i) => { const p = props ? props(f, i) : {}; return { NAME: f.name, VALUE: f.value, LENGTH: p.lengthRaw, AREA: p.areaRaw }; });
      files.push({ name: stem + '.shp', data: shp }, { name: stem + '.shx', data: shx }, { name: stem + '.dbf', data: dbf(rows, fields) }, { name: stem + '.cpg', data: 'UTF-8' });
      if (prj) files.push({ name: stem + '.prj', data: prj });
    }
    return files;
  };
})();
