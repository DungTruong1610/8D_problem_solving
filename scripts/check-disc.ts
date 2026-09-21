import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('db.sqlite');
db.get("SELECT resultJson FROM cnma_proresolve_Disciplines WHERE ID = '2fa065cb-166d-4c52-98b9-43235edc051f'", (err, row: any) => {
  if (err) console.error(err);
  else {
    try {
      const data = JSON.parse(row.resultJson);
      console.log('D1 Data keys:', Object.keys(data));
      console.log('D1 team:', data.team);
    } catch (e: any) {
      console.error('JSON parse error:', e.message);
    }
  }
  db.close();
});
