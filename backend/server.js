const express = require("express");
const cors = require("cors");

require("./database");

const purchasesRoutes = require("./purchases");
const salesRoutes = require("./sales");
const stockRoutes = require("./stock");
const reportsRoutes = require("./reports");

const app = express();

const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Tracker backend is running"
    });
});

app.use("/api/purchases", purchasesRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/reports", reportsRoutes);

app.listen(PORT, () => {
    console.log(`Tracker backend running at http://localhost:${PORT}`);
});