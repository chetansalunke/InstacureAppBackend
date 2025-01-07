const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const app = express();

const port = 80;

app.use(bodyParser.json());

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  database: "api",
  password: "root",
});

const JWT_SECRET = "tpiinfo";
const JWT_REFRESH_SECRET = "tpiinfo";
const JWT_EXPIRES_IN = "10000d";
const JWT_REFRESH_EXPIRES_IN = "7d";

// Handle uncaught exceptions and unhandled promise rejections
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

connection.connect((error) => {
  if (error) {
    console.error("Error Connecting to DB:", error);
    process.exit(1); // Exit process if DB connection fails
  } else {
    console.log("Connected to the Database");
  }
});

app.get("/api", (req, res) => {
  res.send("Hello");
});

const insertDoctor = (doctorData, connection, callback) => {
  const {
    doc_id,
    doctorName,
    address,
    contactNumber,
    area,
    qualification,
    status,
    medicalInfo,
  } = doctorData;

  if (!doctorName || !contactNumber) {
    return callback(
      new Error("Required fields 'doctorName' or 'contactNumber' are missing"),
      null
    );
  }

  const query = `
    INSERT INTO api.doctors (doc_id, name, address, contact, area, qualification, status, medical)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  connection.query(
    query,
    [
      doc_id,
      doctorName,
      address,
      contactNumber,
      area,
      qualification,
      status,
      JSON.stringify(medicalInfo),
    ],
    (err, results) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          console.warn("Duplicate Entry Detected:", err.message);
          return callback(new Error("Duplicate Entry"), null);
        }
        callback(err, null);
      } else {
        callback(null, results);
      }
    }
  );
};

app.post("/api/doctors", (req, res) => {
  const doctorDataArray = Array.isArray(req.body) ? req.body : [req.body];
  let successCount = 0;
  let errorCount = 0;

  doctorDataArray.forEach((doctorData, index) => {
    insertDoctor(doctorData, connection, (err, result) => {
      if (err) {
        errorCount++;
        console.error(`Error inserting doctor at index ${index}:`, err.message);
      } else {
        successCount++;
      }

      if (index === doctorDataArray.length - 1) {
        res.status(200).json({
          message: `${successCount} doctor(s) inserted, ${errorCount} failed`,
        });
      }
    });
  });
});

app.post("/api/employee", (req, res) => {
  const { name, employeeCode, designation, headquarter } = req.body;

  if (!name || !employeeCode || !designation || !headquarter) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const query = `INSERT INTO api.employees (name, employee_code, designation, headquarters) VALUES (?, ?, ?, ?)`;
  connection.query(
    query,
    [name, employeeCode, designation, headquarter],
    (error, result) => {
      if (error) {
        if (error.code === "ER_DUP_ENTRY") {
          console.warn("Duplicate Entry Detected:", error.message);
          return res.status(400).json({ message: "Duplicate employeeCode" });
        }
        console.error("Error inserting employee:", error.message);
        return res.status(500).json({ message: "Database error" });
      }

      const token = jwt.sign({ id: result.insertId }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      res.status(201).json({
        message: "Employee added",
        data: {
          id: result.insertId,
          name,
          employeeCode,
          designation,
          headquarter,
        },
        token,
      });
    }
  );
});

// Example of error handling in other routes
app.get("/api/doctors", (req, res) => {
  const query = "SELECT * FROM api.doctors;";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching doctors:", err.message);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json(results);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
