const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const app = express();

const port = 3000;

app.use(bodyParser.json());

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  database: "api",
  password: "abc54321",
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

app.post("/api/employee", (request, response) => {
  const { name, employeeCode, designation, headquarter } = request.body;

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

app.post("/api/doctors", (req, res) => {
  const {
    doctorName,
    address,
    contactNumber,
    area,
    qualification,
    status,
    medicalInfo,
  } = req.body;

  // Check if all required fields are provided
  if (
    !doctorName ||
    !address ||
    !contactNumber ||
    !area ||
    !qualification ||
    !status ||
    !medicalInfo
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Convert medicalInfo array to a JSON string
  const medicalInfoJson = JSON.stringify(medicalInfo);

  // Define the query for inserting doctor data
  const query = `
      INSERT INTO api.doctors (name, address, contact, area, qualification, status, medical)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

  // Execute the query with the values
  connection.query(
    query,
    [
      doctorName,
      address,
      contactNumber,
      area,
      qualification,
      status,
      medicalInfoJson, // Pass the JSON string of medicalInfo
    ],
    (err, results) => {
      if (err) {
        console.error("Error inserting data:", err.message);
        return res.status(500).json({ error: "Database error" });
      }
      res.status(201).json({
        message: "Doctor added successfully",
        id: results.insertId,
      });
    }
  );
});
app.post("/api/visits", (req, res) => {
  const {
    employee_id,
    doctor_id,
    product_ids,
    town_visited,
    area_worked,
    comment,
    remark,
    working_with,
  } = req.body;

  console.log(req.body);

  // Check if required fields are provided
  if (
    !employee_id ||
    !doctor_id ||
    !product_ids ||
    !Array.isArray(product_ids) ||
    !town_visited ||
    !area_worked
  ) {
    return res
      .status(400)
      .json({ error: "Required fields are missing or invalid" });
  }

  // Convert product_ids to JSON string
  const productIdsJson = JSON.stringify(product_ids);

  // Define the query for inserting visit data
  const query = `
      INSERT INTO api.visits (
        employee_id,
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
      employee_id,
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
        console.error("Error inserting visit data:", err.message);
        return res.status(500).json({ error: "Database error" });
      }
      res.status(201).json({
        message: "Visit added successfully",
        id: results.insertId,
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
  const query = "select * from api.productList;";
  connection.query(query, (error, result) => {
    if (error) {
      console.log("Eror while featching data", error);
      return res.json({ error: "Database Error" });
    }
    res.json(result);
  });
});

app.listen(port, (req, res) => {
  console.log("Server Running on port " + port);
});
