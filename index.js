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
  console.log("GET /api called");
  res.send("Hello");
});

// Function to insert a visit
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
  console.log(`Checking employee existence for code: ${employee_code}`);

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
    console.log(`Checking doctor existence for ID: ${doctor_id}`);

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

      console.log("Inserting visit with data:", {
        employee_code,
        doctor_id,
        product_ids: productIdsJson,
        town_visited,
        area_worked,
        comment,
        remark,
        working_with,
      });

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
            console.log(
              `Visit inserted successfully for employee_code: ${employee_code}`
            );
            callback(null, results);
          }
        }
      );
    });
  });
};

app.post("/api/visits", (req, res) => {
  const visitDataArray = Array.isArray(req.body) ? req.body : [req.body];

  console.log("POST /api/visits called with data:", visitDataArray);

  let successCount = 0;
  let errorCount = 0;

  visitDataArray.forEach((visitData, index) => {
    insertVisit(visitData, connection, (err, result) => {
      if (err) {
        errorCount++;
        console.error(`Error inserting visit at index ${index}:`, err.message);
      } else {
        successCount++;
        console.log(`Visit at index ${index} inserted successfully`);
      }

      // Send response after processing all records
      if (index === visitDataArray.length - 1) {
        console.log(
          `${successCount} visit(s) inserted successfully, ${errorCount} error(s) occurred`
        );
        res.status(200).json({
          message: `${successCount} visit(s) inserted successfully, ${errorCount} error(s) occurred`,
        });
      }
    });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
