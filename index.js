const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const app = express();

// Port configuration
const port = 80;

// JWT Configuration
const JWT_SECRET = "your_jwt_secret"; // Replace with a secure secret key
const JWT_EXPIRES_IN = "1h"; // Adjust expiration as needed

// Middleware
app.use(bodyParser.json());

// Database connection pool
const connection = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "abc54321", // Replace with your database password
  database: "api",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Keep the database connection alive
setInterval(() => {
  connection.query("SELECT 1", (err) => {
    if (err) {
      console.error("Error keeping the connection alive:", err.message);
    }
  });
}, 30000);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Closing database connection...");
  connection.end((err) => {
    if (err) {
      console.error("Error closing the database connection:", err.message);
    }
    console.log("Database connection closed");
    process.exit(0);
  });
});

// Handle uncaught exceptions and unhandled promise rejections
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

// Root API endpoint
app.get("/api", (req, res) => {
  res.send("Hello, API is running!");
});

// Utility function for sending structured responses
const sendResponse = (res, statusCode, message, data = null) => {
  res.status(statusCode).json({ message, data });
};

// Insert a doctor into the database
app.post("/api/doctors", (req, res) => {
  const doctorDataArray = Array.isArray(req.body) ? req.body : [req.body];
  let successCount = 0;
  let errorCount = 0;

  doctorDataArray.forEach((doctorData, index) => {
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

    // Validation
    if (!doctorName || !contactNumber) {
      errorCount++;
      console.error(`Validation failed for doctor at index ${index}`);
      return;
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
        JSON.stringify(medicalInfo || {}),
      ],
      (err) => {
        if (err) {
          errorCount++;
          console.error(
            `Error inserting doctor at index ${index}:`,
            err.message
          );
        } else {
          successCount++;
        }

        if (index === doctorDataArray.length - 1) {
          sendResponse(
            res,
            200,
            `${successCount} doctor(s) inserted, ${errorCount} failed`
          );
        }
      }
    );
  });
});

// Insert an employee and return a JWT token
app.post("/api/employee", (req, res) => {
  const { name, employeeCode, designation, headquarter } = req.body;

  if (!name || !employeeCode || !designation || !headquarter) {
    return sendResponse(res, 400, "Missing required fields");
  }

  const query = `
    INSERT INTO api.employees (name, employee_code, designation, headquarters)
    VALUES (?, ?, ?, ?)
  `;

  connection.query(
    query,
    [name, employeeCode, designation, headquarter],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return sendResponse(res, 400, "Duplicate employeeCode");
        }
        return sendResponse(res, 500, "Database error");
      }

      const token = jwt.sign({ id: result.insertId }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      sendResponse(res, 201, "Employee added", {
        id: result.insertId,
        name,
        employeeCode,
        designation,
        headquarter,
        token,
      });
    }
  );
});

// Insert a visit
app.post("/api/visits", (req, res) => {
  const visitDataArray = Array.isArray(req.body) ? req.body : [req.body];
  let successCount = 0;
  let errorCount = 0;

  visitDataArray.forEach((visitData, index) => {
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
      errorCount++;
      console.error(`Validation failed for visit at index ${index}`);
      return;
    }

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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
      (err) => {
        if (err) {
          errorCount++;
          console.error(
            `Error inserting visit at index ${index}:`,
            err.message
          );
        } else {
          successCount++;
        }

        if (index === visitDataArray.length - 1) {
          sendResponse(
            res,
            200,
            `${successCount} visit(s) inserted, ${errorCount} failed`
          );
        }
      }
    );
  });
});

// Fetch all doctors
app.get("/api/doctors", (req, res) => {
  connection.query("SELECT * FROM api.doctors", (err, results) => {
    if (err) {
      return sendResponse(res, 500, "Database error");
    }
    sendResponse(res, 200, "Doctors fetched successfully", results);
  });
});

// Fetch all visits
app.get("/api/visits", (req, res) => {
  connection.query("SELECT * FROM api.visits", (err, results) => {
    if (err) {
      return sendResponse(res, 500, "Database error");
    }
    sendResponse(res, 200, "Visits fetched successfully", results);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
