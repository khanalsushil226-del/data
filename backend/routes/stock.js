const express = require("express");
const db = require("../database");

const router = express.Router();

router.get("/", (req, res) => {
    try {
        const adjustments = db.prepare(`
            SELECT
                id,
                date,
                quantity,
                reason,
                notes,
                created_at
            FROM stock_adjustments
            ORDER BY date DESC, id DESC
        `).all();

        res.json(adjustments);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to fetch stock adjustments"
        });
    }
});

router.get("/:id", (req, res) => {
    try {
        const adjustment = db.prepare(`
            SELECT
                id,
                date,
                quantity,
                reason,
                notes,
                created_at
            FROM stock_adjustments
            WHERE id = ?
        `).get(req.params.id);

        if (!adjustment) {
            return res.status(404).json({
                error: "Stock adjustment not found"
            });
        }

        res.json(adjustment);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to fetch stock adjustment"
        });
    }
});

router.post("/", (req, res) => {
    try {
        const {
            date,
            quantity,
            reason,
            notes
        } = req.body;

        if (!date || quantity === undefined) {
            return res.status(400).json({
                error: "Date and quantity are required"
            });
        }

        if (Number(quantity) === 0) {
            return res.status(400).json({
                error: "Adjustment quantity cannot be zero"
            });
        }

        const result = db.prepare(`
            INSERT INTO stock_adjustments (
                date,
                quantity,
                reason,
                notes
            )
            VALUES (?, ?, ?, ?)
        `).run(
            date,
            Number(quantity),
            reason || "",
            notes || ""
        );

        const adjustment = db.prepare(`
            SELECT *
            FROM stock_adjustments
            WHERE id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json(adjustment);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to create stock adjustment"
        });
    }
});

router.put("/:id", (req, res) => {
    try {
        const {
            date,
            quantity,
            reason,
            notes
        } = req.body;

        if (!date || quantity === undefined) {
            return res.status(400).json({
                error: "Date and quantity are required"
            });
        }

        if (Number(quantity) === 0) {
            return res.status(400).json({
                error: "Adjustment quantity cannot be zero"
            });
        }

        const existingAdjustment =
            db.prepare(`
                SELECT id
                FROM stock_adjustments
                WHERE id = ?
            `).get(req.params.id);

        if (!existingAdjustment) {
            return res.status(404).json({
                error: "Stock adjustment not found"
            });
        }

        db.prepare(`
            UPDATE stock_adjustments
            SET
                date = ?,
                quantity = ?,
                reason = ?,
                notes = ?
            WHERE id = ?
        `).run(
            date,
            Number(quantity),
            reason || "",
            notes || "",
            req.params.id
        );

        const adjustment = db.prepare(`
            SELECT *
            FROM stock_adjustments
            WHERE id = ?
        `).get(req.params.id);

        res.json(adjustment);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to update stock adjustment"
        });
    }
});

router.delete("/:id", (req, res) => {
    try {
        const existingAdjustment =
            db.prepare(`
                SELECT id
                FROM stock_adjustments
                WHERE id = ?
            `).get(req.params.id);

        if (!existingAdjustment) {
            return res.status(404).json({
                error: "Stock adjustment not found"
            });
        }

        db.prepare(`
            DELETE FROM stock_adjustments
            WHERE id = ?
        `).run(req.params.id);

        res.json({
            message:
                "Stock adjustment deleted successfully"
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to delete stock adjustment"
        });
    }
});

module.exports = router;