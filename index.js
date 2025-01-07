const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const app = express();

const port = 80;

app.use(bodyParser.json());

// Database connection configuration
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  database: "api",
  password: "root",
});

// JWT constants
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

// Establish connection to the database
connection.connect((error) => {
  if (error) {
    console.error("Error Connecting to DB:", error);
    process.exit(1); // Exit process if DB connection fails
  } else {
    console.log("Connected to the Database");
  }
});

// Sample API endpoint
app.get("/api", (req, res) => {
  res.send("Hello");
});

/**
 * Inserts a doctor into the `doctors` table.
 * Validates required fields and handles duplicate entries.
 */
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

  // Validation for required fields
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
  // Insert doctor data into the database
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

// Endpoint to insert doctor data
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

      // Send response after processing all records
      if (index === doctorDataArray.length - 1) {
        res.status(200).json({
          message: `${successCount} doctor(s) inserted, ${errorCount} failed`,
        });
      }
    });
  });
});

/**
 * Inserts an employee into the `employees` table.
 * Generates a JWT token upon successful insertion.
 */
app.post("/api/employee", (req, res) => {
  const { name, employeeCode, designation, headquarter } = req.body;

  // Validation for required fields
  if (!name || !employeeCode || !designation || !headquarter) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const query = `INSERT INTO api.employees (name, employee_code, designation, headquarters) VALUES (?, ?, ?, ?)`;
  // Insert employee data into the database
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

      // Generate JWT token for the employee
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

/**
 * Inserts a visit into the `visits` table.
 * Validates employee existence, doctor existence, and required fields.
 */
const insertVisit = (visitData, connection, callback) => {
  const {
    employee_code,
    doctor_id,
    product_ids,
    town_visited,
    area_worked,
    comment,
    remark,
    working_with,
  } = visitData;

  // Validation for required fields
  if (
    !employee_code ||
    !doctor_id ||
    !product_ids ||
    !Array.isArray(product_ids) ||
    !town_visited ||
    !area_worked
  ) {
    console.error("Validation failed for visitData:", visitData);
    return callback(new Error("Required fields are missing or invalid"), null);
  }

  // Check if the employee_code exists
  const checkEmployeeQuery = `SELECT employee_code FROM api.employees WHERE employee_code = ?`;
  connection.query(checkEmployeeQuery, [employee_code], (err, results) => {
    if (err) {
      console.error("Error querying employees table:", err);
      return callback(err, null);
    }

    if (results.length === 0) {
      console.warn(`Employee with code ${employee_code} does not exist`);
      return callback(
        new Error(`Employee with code ${employee_code} does not exist`),
        null
      );
    }

    // Check if the doctor_id exists
    const checkDoctorQuery = `SELECT doc_id FROM api.doctors WHERE doc_id = ?`;
    connection.query(checkDoctorQuery, [doctor_id], (err, results) => {
      if (err) {
        console.error("Error querying doctors table:", err);
        return callback(err, null);
      }

      if (results.length === 0) {
        console.warn(`Doctor with ID ${doctor_id} does not exist`);
        return callback(
          new Error(`Doctor with ID ${doctor_id} does not exist`),
          null
        );
      }

      // Proceed to insert the visit
      const productIdsJson = JSON.stringify(product_ids);
      const query = `
        INSERT INTO api.visits (
          employee_code,
          doctor_id,
          product_ids,
          town_visited,
          area_worked,
          comment,
          remark,
          working_with
        ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `;

      connection.query(
        query,
        [
          employee_code,
          doctor_id,
          productIdsJson,
          town_visited,
          area_worked,
          comment || null,
          remark || null,
          working_with || null,
        ],
        (err, results) => {
          if (err) {
            console.error("Error inserting visit:", err);
            callback(err, null);
          } else {
            callback(null, results);
          }
        }
      );
    });
  });
};

// Endpoint to insert visit data
app.post("/api/visits", (req, res) => {
  const visitDataArray = Array.isArray(req.body) ? req.body : [req.body];

  let successCount = 0;
  let errorCount = 0;

  visitDataArray.forEach((visitData, index) => {
    insertVisit(visitData, connection, (err, result) => {
      if (err) {
        errorCount++;
        console.error(`Error inserting visit at index ${index}:`, err.message);
      } else {
        successCount++;
      }

      // Send response after processing all records
      if (index === visitDataArray.length - 1) {
        res.status(200).json({
          message: `${successCount} visit(s) inserted successfully, ${errorCount} error(s) occurred`,
        });
      }
    });
  });
});

// Fetch all doctors
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

app.get("/api/visits", (req, res) => {
  const query = "SELECT * FROM api.visits;";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching visits:", err.message);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json(results);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
