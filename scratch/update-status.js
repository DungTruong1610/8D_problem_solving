const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('db.sqlite');

db.run("UPDATE cnma_proresolve_Disciplines SET workState = 'InProgress' WHERE reviewStatus != 'Approved' OR reviewStatus IS NULL", function(err) {
    if (err) {
        console.error(err);
    } else {
        console.log(`Updated ${this.changes} disciplines to InProgress`);
    }
    db.close();
});
