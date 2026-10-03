const express = require("express");
const db = require("../database");

const router = express.Router();

router.get("/", (req, res) => {
    try {
        const purchases = db.prepare(`
            SELECT
                id,
                date,
                quantity,
                unit_price,
                total_amount,
                supplier,
                reference,
                notes,
                created_at
            FROM purchases
            ORDER BY date DESC, id DESC
        `).all();

        res.json(purchases);
    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch purchases"
        });
    }
});

router.get("/:id", (req, res) => {
    try {
        const purchase = db.prepare(`
            SELECT
                id,
                date,
                quantity,
                unit_price,
                total_amount,
                supplier,
                reference,
                notes,
                created_at
            FROM purchases
            WHERE id = ?
        `).get(req.params.id);

        if (!purchase) {
            return res.status(404).json({
                error: "Purchase not found"
            });
        }

        res.json(purchase);
    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch purchase"
        });
    }
});

router.post("/", (req, res) => {
    try {
        const {
            date,
            quantity,
            unit_price,
            supplier,
            reference,
            notes
        } = req.body;

        if (!date || quantity === undefined || unit_price === undefined) {
            return res.status(400).json({
                error: "Date, quantity and unit price are required"
            });
        }

        if (Number(quantity) <= 0) {
            return res.status(400).json({
                error: "Quantity must be greater than 0"
            });
        }

        if (Number(unit_price) < 0) {
            return res.status(400).json({
                error: "Unit price cannot be negative"
            });
        }

        const total_amount = Number(quantity) * Number(unit_price);

        const result = db.prepare(`
            INSERT INTO purchases (
                date,
                quantity,
                unit_price,
                total_amount,
                supplier,
                reference,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            date,
            Number(quantity),
            Number(unit_price),
            total_amount,
            supplier || "",
            reference || "",
            notes || ""
        );

        const purchase = db.prepare(`
            SELECT *
            FROM purchases
            WHERE id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json(purchase);
    } catch (error) {
        res.status(500).json({
            error: "Failed to create purchase"
        });
    }
});

router.put("/:id", (req, res) => {
    try {
        const {
            date,
            quantity,
            unit_price,
            supplier,
            reference,
            notes
        } = req.body;

        if (!date || quantity === undefined || unit_price === undefined) {
            return res.status(400).json({
                error: "Date, quantity and unit price are required"
            });
        }

        if (Number(quantity) <= 0) {
            return res.status(400).json({
                error: "Quantity must be greater than 0"
            });
        }

        if (Number(unit_price) < 0) {
            return res.status(400).json({
                error: "Unit price cannot be negative"
            });
        }

        const existingPurchase = db.prepare(`
            SELECT id
            FROM purchases
            WHERE id = ?
        `).get(req.params.id);

        if (!existingPurchase) {
            return res.status(404).json({
                error: "Purchase not found"
            });
        }

        const total_amount = Number(quantity) * Number(unit_price);

        db.prepare(`
            UPDATE purchases
            SET
                date = ?,
                quantity = ?,
                unit_price = ?,
                total_amount = ?,
                supplier = ?,
                reference = ?,
                notes = ?
            WHERE id = ?
        `).run(
            date,
            Number(quantity),
            Number(unit_price),
            total_amount,
            supplier || "",
            reference || "",
            notes || "",
            req.params.id
        );

        const purchase = db.prepare(`
            SELECT *
            FROM purchases
            WHERE id = ?
        `).get(req.params.id);

        res.json(purchase);
    } catch (error) {
        res.status(500).json({
            error: "Failed to update purchase"
        });
    }
});

router.delete("/:id", (req, res) => {
    try {
        const existingPurchase = db.prepare(`
            SELECT id
            FROM purchases
            WHERE id = ?
        `).get(req.params.id);

        if (!existingPurchase) {
            return res.status(404).json({
                error: "Purchase not found"
            });
        }

        db.prepare(`
            DELETE FROM purchases
            WHERE id = ?
        `).run(req.params.id);

        res.json({
            message: "Purchase deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to delete purchase"
        });
    }
});

module.exports = router;