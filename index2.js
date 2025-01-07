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

connection.connect((error) => {
  if (error) {
    console.log("error Conection DB" + error);
    return;
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

  // Correct the variable names in the validation check
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
      doctorName, // Use 'doctorName' here
      address,
      contactNumber, // Use 'contactNumber' here
      area,
      qualification,
      status,
      JSON.stringify(medicalInfo),
    ],
    (err, results) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, results);
      }
    }
  );
};
app.post("/api/doctors", (req, res) => {
  const doctorDataArray = Array.isArray(req.body) ? req.body : [req.body];
  console.log([req.body]);

  let successCount = 0;
  let errorOccurred = false;

  const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    database: "api",
    password: "root",
  });

  connection.connect((err) => {
    if (err) {
      console.error("Error connecting to the database:", err);
      return res
        .status(500)
        .json({ message: "Database connection error", error: err });
    }

    doctorDataArray.forEach((doctorData, index) => {
      insertDoctor(doctorData, connection, (err, result) => {
        if (err) {
          errorOccurred = true;
          console.log("Error inserting doctor:", err);
          return res
            .status(500)
            .json({ message: "Error inserting doctor", error: err });
        } else {
          successCount += 1;
        }

        if (successCount === doctorDataArray.length && !errorOccurred) {
          res.status(200).json({
            message: `${successCount} doctor(s) inserted successfully!`,
            doctorData: result,
          });
          connection.end();
        }
      });
    });
  });
});

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
    return callback(new Error("Required fields are missing or invalid"), null);
  }

  // First, check if the employee_code exists in the employees table
  const checkEmployeeQuery = `SELECT employee_code FROM api.employees WHERE employee_code = ?`;

  connection.query(checkEmployeeQuery, [employee_code], (err, results) => {
    if (err) {
      return callback(err, null); // Return if there's an error querying the employees table
    }

    // If no employee with this code is found, return an error
    if (results.length === 0) {
      return callback(
        new Error(`Employee with code ${employee_code} does not exist`),
        null
      );
    }
    // Next, check if the doctor_id exists in the doctors table
    const checkDoctorQuery = `SELECT doc_id FROM api.doctors WHERE doc_id = ?`;
    console.log(checkDoctorQuery);

    connection.query(checkDoctorQuery, [doctor_id], (err, results) => {
      if (err) {
        return callback(err, null); // Return if there's an error querying the doctors table
      }

      // If no doctor with this id is found, return an error
      if (results.length === 0) {
        return callback(
          new Error(`Doctor with ID ${doctor_id} does not exist`),
          null
        );
      }

      // If both the employee and doctor exist, proceed to insert the visit
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
      console.log("Printing Query");
      console.log(query);

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
            callback(err, null);
          } else {
            callback(null, results);
          }
        }
      );
    });
  });
};
app.post("/api/visits", (req, res) => {
  const visitDataArray = Array.isArray(req.body) ? req.body : [req.body];

  console.log([req.body]);

  let successCount = 0;
  let errorOccurred = false;

  const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    database: "api",
    password: "root",
  });

  connection.connect((err) => {
    if (err) {
      console.log("Error connecting to the database:", err);
      return res
        .status(500)
        .json({ message: "Database connection error", error: err });
    }

    visitDataArray.forEach((visitData) => {
      insertVisit(visitData, connection, (err, result) => {
        if (err) {
          errorOccurred = true;
          console.log("Error inserting visit:", err);
          return res
            .status(500)
            .json({ message: "Error inserting visit", error: err.message });
        } else {
          successCount += 1;
        }

        // If all visits are successfully inserted, respond
        if (successCount === visitDataArray.length && !errorOccurred) {
          res.status(200).json({
            message: `${successCount} visit(s) added successfully!`,
            visitData: result,
          });
          connection.end();
        }
      });
    });
  });
});
app.post("/api/employee", (request, response) => {
  const { name, employeeCode, designation, headquarter } = request.body;

  // Check if all required fields are provided
  if (!name || !employeeCode || !designation || !headquarter) {
    return response.send("Not Getting All Fields");
  }

  const query = `insert into api.employees(name,employee_code,designation,headquarters) VALUES (?,?,?,?);`;
  connection.query(
    query,
    [name, employeeCode, designation, headquarter],
    (error, result) => {
      if (error) {
        console.log("Error while Inserting Data " + error);
        return response.json({ error: "Insertion Error" });
      }

      const token = jwt.sign({ id: result.insertId }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      return response.json({
        message: "Employee Added",
        data: {
          id: result.insertId,
          name,
          employeeCode,
          designation,
          headquarter,
        },
        token: token,
      });
    }
  );
});
app.get("/api/doctors", (req, res) => {
  const query = "SELECT * FROM api.doctors;";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching data:", err.message);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
});

app.get("/api/productlist", (req, res) => {
  const query = "SELECT * FROM api.productList;";
  connection.query(query, (error, result) => {
    if (error) {
      console.log("Error while fetching data", error);
      return res.json({ error: "Database Error" });
    }
    res.json(result);
  });
});

app.listen(port, (req, res) => {
  console.log("Server Running on port " + port);
});
