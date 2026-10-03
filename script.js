const STORAGE_KEY = "trackerData";
const API_BASE_URL = "http://localhost:5000/api";

const defaultData = {
    openingStock: 0,
    purchases: [],
    sales: [],
    adjustments: [],
    settings: {
        storeName: "Tracker",
        phone: "",
        address: "",
        purchasePrice: 0,
        sellingPrice: 0,
        lowStockLimit: 10
    }
};

let data = loadData();

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return structuredClone(defaultData);
        }

        const parsed = JSON.parse(saved);

        return {
            ...structuredClone(defaultData),
            ...parsed,
            purchases: Array.isArray(parsed.purchases)
                ? parsed.purchases
                : [],
            sales: Array.isArray(parsed.sales)
                ? parsed.sales
                : [],
            adjustments: Array.isArray(parsed.adjustments)
                ? parsed.adjustments
                : [],
            settings: {
                ...defaultData.settings,
                ...(parsed.settings || {})
            }
        };
    } catch (error) {
        console.error("Failed to load Tracker data:", error);
        return structuredClone(defaultData);
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function loadPurchasesFromBackend() {
    try {
        const response = await fetch(`${API_BASE_URL}/purchases`);

        if (!response.ok) {
            throw new Error("Failed to load purchases");
        }

        const purchases = await response.json();

        data.purchases = purchases.map(item => ({
            id: item.id,
            date: item.date,
            createdAt: Date.parse(item.created_at) || Date.now(),
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            totalAmount: Number(item.total_amount),
            supplier: item.supplier || "",
            reference: item.reference || "",
            notes: item.notes || ""
        }));

        saveData();

        return true;
    } catch (error) {
        console.error("Purchase API error:", error);
        return false;
    }
}

async function loadSalesFromBackend() {
    try {
        const response = await fetch(`${API_BASE_URL}/sales`);

        if (!response.ok) {
            throw new Error("Failed to load sales");
        }

        const sales = await response.json();

        data.sales = sales.map(item => ({
            id: item.id,
            date: item.date,
            createdAt: Date.parse(item.created_at) || Date.now(),
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            totalAmount: Number(item.total_amount),
            paymentMethod: item.payment_method || "",
            reference: item.reference || "",
            notes: item.notes || ""
        }));

        saveData();

        return true;
    } catch (error) {
        console.error("Sales API error:", error);
        return false;
    }
}

function generateId(prefix = "item") {
    return `${prefix}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
}

function formatCurrency(value) {
    const number = Number(value) || 0;

    return `Rs. ${number.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function formatNumber(value) {
    return (Number(value) || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

function getToday() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "-";
    }

    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return dateValue;
    }

    return date.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function isSameDate(dateA, dateB) {
    return dateA === dateB;
}

function getAllInventoryEvents() {
    const purchases = data.purchases.map(item => ({
        type: "purchase",
        date: item.date,
        createdAt: item.createdAt || 0,
        id: item.id,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        item
    }));

    const sales = data.sales.map(item => ({
        type: "sale",
        date: item.date,
        createdAt: item.createdAt || 0,
        id: item.id,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        item
    }));

    const adjustments = data.adjustments.map(item => ({
        type: "adjustment",
        date: item.date,
        createdAt: item.createdAt || 0,
        id: item.id,
        quantity: Number(item.quantity) || 0,
        unitPrice: 0,
        item
    }));

    return [...purchases, ...sales, ...adjustments].sort((a, b) => {
        const dateCompare = String(a.date).localeCompare(String(b.date));

        if (dateCompare !== 0) {
            return dateCompare;
        }

        return Number(a.createdAt) - Number(b.createdAt);
    });
}

function getInventoryState(untilDate = null) {
    let quantity = Number(data.openingStock) || 0;
    let value =
        quantity * (Number(data.settings.purchasePrice) || 0);

    const events = getAllInventoryEvents();

    for (const event of events) {
        if (untilDate && event.date > untilDate) {
            continue;
        }

        if (event.type === "purchase") {
            quantity += event.quantity;
            value += event.quantity * event.unitPrice;
        }

        if (event.type === "sale") {
            if (quantity > 0) {
                const averageCost = value / quantity;

                value -=
                    Math.min(event.quantity, quantity) *
                    averageCost;
            }

            quantity -= event.quantity;

            if (quantity < 0) {
                quantity = 0;
            }

            if (value < 0) {
                value = 0;
            }
        }

        if (event.type === "adjustment") {
            if (event.quantity > 0) {
                const averageCost =
                    quantity > 0
                        ? value / quantity
                        : Number(data.settings.purchasePrice) || 0;

                quantity += event.quantity;
                value += event.quantity * averageCost;
            } else if (event.quantity < 0) {
                const removeQuantity = Math.min(
                    Math.abs(event.quantity),
                    quantity
                );

                const averageCost =
                    quantity > 0
                        ? value / quantity
                        : 0;

                quantity -= removeQuantity;
                value -= removeQuantity * averageCost;

                if (quantity < 0) {
                    quantity = 0;
                }

                if (value < 0) {
                    value = 0;
                }
            }
        }
    }

    return {
        quantity,
        value,
        averageCost: quantity > 0 ? value / quantity : 0
    };
}

function getCurrentStock() {
    return getInventoryState().quantity;
}

function getStockValue() {
    return getInventoryState().value;
}

function getAveragePurchasePrice() {
    return getInventoryState().averageCost;
}

function getTotalPurchase() {
    return data.purchases.reduce(
        (total, item) =>
            total + (Number(item.totalAmount) || 0),
        0
    );
}

function getTotalSales() {
    return data.sales.reduce(
        (total, item) =>
            total + (Number(item.totalAmount) || 0),
        0
    );
}

function getTotalItemsPurchased() {
    return data.purchases.reduce(
        (total, item) =>
            total + (Number(item.quantity) || 0),
        0
    );
}

function getTotalItemsSold() {
    return data.sales.reduce(
        (total, item) =>
            total + (Number(item.quantity) || 0),
        0
    );
}

function getSaleCost(saleId) {
    let quantity = Number(data.openingStock) || 0;

    let value =
        quantity * (Number(data.settings.purchasePrice) || 0);

    const events = getAllInventoryEvents();

    for (const event of events) {
        if (event.type === "purchase") {
            quantity += event.quantity;
            value += event.quantity * event.unitPrice;
        }

        if (event.type === "sale") {
            if (quantity > 0) {
                const averageCost = value / quantity;
                const cost = event.quantity * averageCost;

                if (event.id === saleId) {
                    return cost;
                }

                value -=
                    Math.min(event.quantity, quantity) *
                    averageCost;
            }

            quantity -= event.quantity;

            if (quantity < 0) {
                quantity = 0;
            }

            if (value < 0) {
                value = 0;
            }
        }

        if (event.type === "adjustment") {
            if (event.quantity > 0) {
                const averageCost =
                    quantity > 0
                        ? value / quantity
                        : Number(data.settings.purchasePrice) || 0;

                quantity += event.quantity;
                value += event.quantity * averageCost;
            } else if (event.quantity < 0) {
                const removeQuantity = Math.min(
                    Math.abs(event.quantity),
                    quantity
                );

                const averageCost =
                    quantity > 0
                        ? value / quantity
                        : 0;

                quantity -= removeQuantity;
                value -= removeQuantity * averageCost;

                if (quantity < 0) {
                    quantity = 0;
                }

                if (value < 0) {
                    value = 0;
                }
            }
        }
    }

    return 0;
}

function getTotalProfit() {
    return data.sales.reduce((total, sale) => {
        const revenue = Number(sale.totalAmount) || 0;
        const cost = getSaleCost(sale.id);

        return total + revenue - cost;
    }, 0);
}

function getTodaySales() {
    const today = getToday();

    return data.sales
        .filter(item => isSameDate(item.date, today))
        .reduce(
            (total, item) =>
                total + (Number(item.totalAmount) || 0),
            0
        );
}

function getTodayPurchase() {
    const today = getToday();

    return data.purchases
        .filter(item => isSameDate(item.date, today))
        .reduce(
            (total, item) =>
                total + (Number(item.totalAmount) || 0),
            0
        );
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function initializeDates() {
    const today = getToday();

    const dateFields = [
        "stockDate",
        "saleDate"
    ];

    dateFields.forEach(id => {
        const field = document.getElementById(id);

        if (field && !field.value) {
            field.value = today;
        }
    });

    const purchaseFromDate =
        document.getElementById("purchaseFromDate");

    const purchaseToDate =
        document.getElementById("purchaseToDate");

    if (purchaseToDate && !purchaseToDate.value) {
        purchaseToDate.value = today;
    }

    if (purchaseFromDate && !purchaseFromDate.value) {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        purchaseFromDate.value =
            date.toISOString().split("T")[0];
    }

    const salesFromDate =
        document.getElementById("salesFromDate");

    const salesToDate =
        document.getElementById("salesToDate");

    if (salesToDate && !salesToDate.value) {
        salesToDate.value = today;
    }

    if (salesFromDate && !salesFromDate.value) {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        salesFromDate.value =
            date.toISOString().split("T")[0];
    }

    const reportToDate =
        document.getElementById("reportToDate");

    const reportFromDate =
        document.getElementById("reportFromDate");

    if (reportToDate && !reportToDate.value) {
        reportToDate.value = today;
    }

    if (reportFromDate && !reportFromDate.value) {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        reportFromDate.value =
            date.toISOString().split("T")[0];
    }
}
function updateDashboard() {
    const currentStock = getCurrentStock();
    const totalPurchase = getTotalPurchase();
    const totalSales = getTotalSales();
    const totalProfit = getTotalProfit();

    setText(
        "currentDate",
        new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        })
    );

    setText(
        "currentStock",
        formatNumber(currentStock)
    );

    setText(
        "totalPurchase",
        formatCurrency(totalPurchase)
    );

    setText(
        "totalSales",
        formatCurrency(totalSales)
    );

    setText(
        "totalProfit",
        formatCurrency(totalProfit)
    );

    setText(
        "todaySales",
        formatCurrency(getTodaySales())
    );

    setText(
        "todayPurchase",
        formatCurrency(getTodayPurchase())
    );

    setText(
        "totalItemsPurchased",
        formatNumber(getTotalItemsPurchased())
    );

    setText(
        "totalItemsSold",
        formatNumber(getTotalItemsSold())
    );

    updateDashboardPeriod();
    updateSalesChart();
    updateStockSummary();
    updateLowStockAlert();
    renderRecentActivity();
}

function updateDashboardPeriod() {
    const period = document.getElementById("dashboardPeriod");

    if (!period) {
        return;
    }

    const value = period.value || "all";

    let purchases = [...data.purchases];
    let sales = [...data.sales];

    const today = new Date();

    if (value === "today") {
        const date = getToday();

        purchases = purchases.filter(
            item => item.date === date
        );

        sales = sales.filter(
            item => item.date === date
        );
    }

    if (value === "week") {
        const start = new Date(today);
        start.setDate(today.getDate() - 6);

        const startDate =
            start.toISOString().split("T")[0];

        purchases = purchases.filter(
            item => item.date >= startDate
        );

        sales = sales.filter(
            item => item.date >= startDate
        );
    }

    if (value === "month") {
        const year = today.getFullYear();
        const month = String(
            today.getMonth() + 1
        ).padStart(2, "0");

        const startDate = `${year}-${month}-01`;

        purchases = purchases.filter(
            item => item.date >= startDate
        );

        sales = sales.filter(
            item => item.date >= startDate
        );
    }

    const purchaseTotal = purchases.reduce(
        (total, item) =>
            total + (Number(item.totalAmount) || 0),
        0
    );

    const salesTotal = sales.reduce(
        (total, item) =>
            total + (Number(item.totalAmount) || 0),
        0
    );

    const itemsPurchased = purchases.reduce(
        (total, item) =>
            total + (Number(item.quantity) || 0),
        0
    );

    const itemsSold = sales.reduce(
        (total, item) =>
            total + (Number(item.quantity) || 0),
        0
    );

    setText(
        "periodPurchase",
        formatCurrency(purchaseTotal)
    );

    setText(
        "periodSales",
        formatCurrency(salesTotal)
    );

    setText(
        "periodItemsPurchased",
        formatNumber(itemsPurchased)
    );

    setText(
        "periodItemsSold",
        formatNumber(itemsSold)
    );
}

function updateStockSummary() {
    const openingStock =
        Number(data.openingStock) || 0;

    const stockIn = getTotalItemsPurchased();

    const stockOut = getTotalItemsSold();

    const currentStock = getCurrentStock();

    setText(
        "openingStock",
        formatNumber(openingStock)
    );

    setText(
        "summaryStockIn",
        formatNumber(stockIn)
    );

    setText(
        "summaryStockOut",
        formatNumber(stockOut)
    );

    setText(
        "summaryCurrentStock",
        formatNumber(currentStock)
    );
}

function updateLowStockAlert() {
    const alertBox =
        document.getElementById("lowStockAlert");

    if (!alertBox) {
        return;
    }

    const currentStock = getCurrentStock();

    const limit =
        Number(data.settings.lowStockLimit) || 0;

    if (currentStock <= limit) {
        alertBox.classList.remove("hidden");

        alertBox.innerHTML = `
            <strong>Low Stock</strong>
            <span>
                Current stock is ${formatNumber(currentStock)}
                pieces. Your low stock limit is
                ${formatNumber(limit)} pieces.
            </span>
        `;
    } else {
        alertBox.classList.add("hidden");
        alertBox.innerHTML = "";
    }
}

function getLastSevenDays() {
    const days = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date();

        date.setDate(
            date.getDate() - i
        );

        const year = date.getFullYear();

        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            date.getDate()
        ).padStart(2, "0");

        days.push({
            date: `${year}-${month}-${day}`,
            label: date.toLocaleDateString(
                "en-IN",
                {
                    weekday: "short"
                }
            )
        });
    }

    return days;
}

function updateSalesChart() {
    const chart =
        document.getElementById("salesChart");

    if (!chart) {
        return;
    }

    const days = getLastSevenDays();

    const values = days.map(day => {
        return data.sales
            .filter(
                sale => sale.date === day.date
            )
            .reduce(
                (total, sale) =>
                    total +
                    (Number(sale.totalAmount) || 0),
                0
            );
    });

    const maxValue =
        Math.max(...values, 1);

    chart.innerHTML = `
        <div class="chart-bars">
            ${values.map((value, index) => {
                const height = Math.max(
                    5,
                    (value / maxValue) * 100
                );

                return `
                    <div class="chart-column">
                        <div class="chart-value">
                            ${formatCurrency(value)}
                        </div>

                        <div
                            class="chart-bar"
                            style="height:${height}%"
                        ></div>

                        <div class="chart-label">
                            ${days[index].label}
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function getActivityList() {
    const activities = [];

    data.purchases.forEach(item => {
        activities.push({
            date: item.date,
            createdAt: item.createdAt || 0,
            type: "Stock In",
            description:
                `Purchased ${formatNumber(item.quantity)} pieces`,
            amount:
                Number(item.totalAmount) || 0
        });
    });

    data.sales.forEach(item => {
        activities.push({
            date: item.date,
            createdAt: item.createdAt || 0,
            type: "Sale",
            description:
                `Sold ${formatNumber(item.quantity)} pieces`,
            amount:
                Number(item.totalAmount) || 0
        });
    });

    data.adjustments.forEach(item => {
        activities.push({
            date: item.date,
            createdAt: item.createdAt || 0,
            type: "Adjustment",
            description:
                `${item.quantity >= 0 ? "Added" : "Removed"} ${formatNumber(Math.abs(item.quantity))} pieces`,
            amount: 0
        });
    });

    return activities.sort((a, b) => {
        const dateCompare =
            String(b.date).localeCompare(
                String(a.date)
            );

        if (dateCompare !== 0) {
            return dateCompare;
        }

        return (
            Number(b.createdAt) -
            Number(a.createdAt)
        );
    });
}

function renderRecentActivity() {
    const container =
        document.getElementById("recentActivity");

    if (!container) {
        return;
    }

    const activities =
        getActivityList().slice(0, 8);

    if (!activities.length) {
        container.innerHTML = `
            <tr>
                <td colspan="4">
                    No recent activity
                </td>
            </tr>
        `;

        return;
    }

    container.innerHTML =
        activities.map(activity => `
            <tr>
                <td>
                    ${formatDate(activity.date)}
                </td>

                <td>
                    ${activity.type}
                </td>

                <td>
                    ${activity.description}
                </td>

                <td>
                    ${
                        activity.amount
                            ? formatCurrency(
                                activity.amount
                            )
                            : "-"
                    }
                </td>
            </tr>
        `).join("");
}

function renderStockPage() {
    const currentStock =
        getCurrentStock();

    const stockValue =
        getStockValue();

    const averageCost =
        getAveragePurchasePrice();

    const sellingPrice =
        Number(data.settings.sellingPrice) || 0;

    const potentialProfit =
        (sellingPrice - averageCost) *
        currentStock;

    setText(
        "stockPageQuantity",
        formatNumber(currentStock)
    );

    setText(
        "stockPurchaseValue",
        formatCurrency(stockValue)
    );

    setText(
        "stockSalesValue",
        formatCurrency(
            currentStock * sellingPrice
        )
    );

    setText(
        "potentialProfit",
        formatCurrency(potentialProfit)
    );

    setText(
        "detailCurrentStock",
        `${formatNumber(currentStock)} pieces`
    );

    setText(
        "detailPurchasePrice",
        formatCurrency(averageCost)
    );

    setText(
        "detailSellingPrice",
        formatCurrency(sellingPrice)
    );

    setText(
        "detailLowStock",
        `${formatNumber(
            data.settings.lowStockLimit
        )} pieces`
    );

    setText(
        "detailStockValue",
        formatCurrency(stockValue)
    );

    updateStockStatus();
    renderStockMovements();
}

function updateStockStatus() {
    const status =
        document.getElementById("stockStatus");

    if (!status) {
        return;
    }

    const stock = getCurrentStock();

    const limit =
        Number(data.settings.lowStockLimit) || 0;

    if (stock <= 0) {
        status.textContent = "Out of Stock";
        status.className =
            "stock-status danger";
    } else if (stock <= limit) {
        status.textContent = "Low Stock";
        status.className =
            "stock-status warning";
    } else {
        status.textContent = "In Stock";
        status.className =
            "stock-status success";
    }
}

function renderStockMovements() {
    const table =
        document.getElementById(
            "stockMovementTable"
        );

    if (!table) {
        return;
    }

    const movements = [];

    data.purchases.forEach(item => {
        movements.push({
            date: item.date,
            createdAt: item.createdAt || 0,
            type: "Stock In",
            quantity:
                Number(item.quantity) || 0,
            reference:
                item.reference ||
                item.supplier ||
                "-",
            notes: item.notes || "-"
        });
    });

    data.sales.forEach(item => {
        movements.push({
            date: item.date,
            createdAt: item.createdAt || 0,
            type: "Sale",
            quantity:
                -(Number(item.quantity) || 0),
            reference:
                item.reference || "-",
            notes: item.notes || "-"
        });
    });

    data.adjustments.forEach(item => {
        movements.push({
            date: item.date,
            createdAt: item.createdAt || 0,
            type: "Adjustment",
            quantity:
                Number(item.quantity) || 0,
            reference:
                item.reason || "-",
            notes:
                item.notes || "-"
        });
    });

    movements.sort((a, b) => {
        const dateCompare =
            String(b.date).localeCompare(
                String(a.date)
            );

        if (dateCompare !== 0) {
            return dateCompare;
        }

        return (
            Number(b.createdAt) -
            Number(a.createdAt)
        );
    });

    if (!movements.length) {
        table.innerHTML = `
            <tr>
                <td colspan="5">
                    No stock movement found
                </td>
            </tr>
        `;

        return;
    }

    table.innerHTML =
        movements.map(item => `
            <tr>
                <td>
                    ${formatDate(item.date)}
                </td>

                <td>
                    ${item.type}
                </td>

                <td class="${
                    item.quantity >= 0
                        ? "text-success"
                        : "text-danger"
                }">
                    ${
                        item.quantity >= 0
                            ? "+"
                            : ""
                    }${formatNumber(
                        item.quantity
                    )}
                </td>

                <td>
                    ${item.reference}
                </td>

                <td>
                    ${item.notes}
                </td>
            </tr>
        `).join("");
}

function renderPurchasePage() {
    const purchases =
        getFilteredPurchases();

    const totalQuantity =
        purchases.reduce(
            (total, item) =>
                total +
                (Number(item.quantity) || 0),
            0
        );

    const totalAmount =
        purchases.reduce(
            (total, item) =>
                total +
                (Number(item.totalAmount) || 0),
            0
        );

    setText(
        "stockInQuantity",
        formatNumber(totalQuantity)
    );

    setText(
        "stockInAmount",
        formatCurrency(totalAmount)
    );

    renderPurchaseTable(purchases);
}

function getFilteredPurchases() {
    const fromDate =
        document.getElementById(
            "purchaseFromDate"
        )?.value || "";

    const toDate =
        document.getElementById(
            "purchaseToDate"
        )?.value || "";

    return data.purchases
        .filter(item => {
            if (
                fromDate &&
                item.date < fromDate
            ) {
                return false;
            }

            if (
                toDate &&
                item.date > toDate
            ) {
                return false;
            }

            return true;
        })
        .sort((a, b) => {
            const dateCompare =
                String(b.date).localeCompare(
                    String(a.date)
                );

            if (dateCompare !== 0) {
                return dateCompare;
            }

            return (
                Number(b.createdAt) -
                Number(a.createdAt)
            );
        });
}

function renderPurchaseTable(purchases) {
    const table =
        document.getElementById(
            "purchaseTable"
        );

    if (!table) {
        return;
    }

    if (!purchases.length) {
        table.innerHTML = `
            <tr>
                <td colspan="8">
                    No purchase records found
                </td>
            </tr>
        `;

        return;
    }

    table.innerHTML =
        purchases.map(item => `
            <tr>
                <td>
                    ${formatDate(item.date)}
                </td>

                <td>
                    ${formatNumber(item.quantity)}
                </td>

                <td>
                    ${formatCurrency(item.unitPrice)}
                </td>

                <td>
                    ${formatCurrency(item.totalAmount)}
                </td>

                <td>
                    ${item.supplier || "-"}
                </td>

                <td>
                    ${item.reference || "-"}
                </td>

                <td>
                    ${item.notes || "-"}
                </td>

                <td>
                    <button
                        type="button"
                        class="table-delete-btn"
                        data-purchase-delete="${item.id}"
                    >
                        Delete
                    </button>
                </td>
            </tr>
        `).join("");

    table
        .querySelectorAll(
            "[data-purchase-delete]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    deletePurchase(
                        button.dataset
                            .purchaseDelete
                    );
                }
            );
        });
}

function renderSalesPage() {
    const sales =
        getFilteredSales();

    const totalQuantity =
        sales.reduce(
            (total, item) =>
                total +
                (Number(item.quantity) || 0),
            0
        );

    const totalAmount =
        sales.reduce(
            (total, item) =>
                total +
                (Number(item.totalAmount) || 0),
            0
        );

    const totalProfit =
        sales.reduce(
            (total, item) => {
                const revenue =
                    Number(item.totalAmount) || 0;

                const cost =
                    getSaleCost(item.id);

                return (
                    total +
                    revenue -
                    cost
                );
            },
            0
        );

    setText(
        "salesQuantity",
        formatNumber(totalQuantity)
    );

    setText(
        "salesAmount",
        formatCurrency(totalAmount)
    );

    setText(
        "salesProfit",
        formatCurrency(totalProfit)
    );

    renderSalesTable(sales);
}

function getFilteredSales() {
    const fromDate =
        document.getElementById(
            "salesFromDate"
        )?.value || "";

    const toDate =
        document.getElementById(
            "salesToDate"
        )?.value || "";

    return data.sales
        .filter(item => {
            if (
                fromDate &&
                item.date < fromDate
            ) {
                return false;
            }

            if (
                toDate &&
                item.date > toDate
            ) {
                return false;
            }

            return true;
        })
        .sort((a, b) => {
            const dateCompare =
                String(b.date).localeCompare(
                    String(a.date)
                );

            if (dateCompare !== 0) {
                return dateCompare;
            }

            return (
                Number(b.createdAt) -
                Number(a.createdAt)
            );
        });
}

function renderSalesTable(sales) {
    const table =
        document.getElementById(
            "salesTable"
        );

    if (!table) {
        return;
    }

    if (!sales.length) {
        table.innerHTML = `
            <tr>
                <td colspan="9">
                    No sales records found
                </td>
            </tr>
        `;

        return;
    }

    table.innerHTML =
        sales.map(item => {
            const revenue =
                Number(item.totalAmount) || 0;

            const cost =
                getSaleCost(item.id);

            const profit =
                revenue - cost;

            return `
                <tr>
                    <td>
                        ${formatDate(item.date)}
                    </td>

                    <td>
                        ${formatNumber(
                            item.quantity
                        )}
                    </td>

                    <td>
                        ${formatCurrency(
                            item.unitPrice
                        )}
                    </td>

                    <td>
                        ${formatCurrency(
                            revenue
                        )}
                    </td>

                    <td>
                        ${formatCurrency(
                            cost
                        )}
                    </td>

                    <td>
                        ${formatCurrency(
                            profit
                        )}
                    </td>

                    <td>
                        ${
                            item.paymentMethod ||
                            "-"
                        }
                    </td>

                    <td>
                        ${
                            item.reference ||
                            "-"
                        }
                    </td>

                    <td>
                        <button
                            type="button"
                            class="table-delete-btn"
                            data-sale-delete="${item.id}"
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

    table
        .querySelectorAll(
            "[data-sale-delete]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    deleteSale(
                        button.dataset
                            .saleDelete
                    );
                }
            );
        });
}

function getReportData(fromDate, toDate) {
    const purchases =
        data.purchases.filter(item => {
            return (
                (!fromDate ||
                    item.date >= fromDate) &&
                (!toDate ||
                    item.date <= toDate)
            );
        });

    const sales =
        data.sales.filter(item => {
            return (
                (!fromDate ||
                    item.date >= fromDate) &&
                (!toDate ||
                    item.date <= toDate)
            );
        });

    const totalPurchase =
        purchases.reduce(
            (total, item) =>
                total +
                (Number(item.totalAmount) || 0),
            0
        );

    const totalSales =
        sales.reduce(
            (total, item) =>
                total +
                (Number(item.totalAmount) || 0),
            0
        );

    const itemsPurchased =
        purchases.reduce(
            (total, item) =>
                total +
                (Number(item.quantity) || 0),
            0
        );

    const itemsSold =
        sales.reduce(
            (total, item) =>
                total +
                (Number(item.quantity) || 0),
            0
        );

    const profit =
        sales.reduce(
            (total, item) => {
                const revenue =
                    Number(item.totalAmount) || 0;

                const cost =
                    getSaleCost(item.id);

                return (
                    total +
                    revenue -
                    cost
                );
            },
            0
        );

    return {
        purchases,
        sales,
        totalPurchase,
        totalSales,
        itemsPurchased,
        itemsSold,
        profit
    };
}

function updateReports() {
    const fromDate =
        document.getElementById(
            "reportFromDate"
        )?.value || "";

    const toDate =
        document.getElementById(
            "reportToDate"
        )?.value || "";

    const report =
        getReportData(
            fromDate,
            toDate
        );

    setText(
        "reportPurchase",
        formatCurrency(
            report.totalPurchase
        )
    );

    setText(
        "reportSales",
        formatCurrency(
            report.totalSales
        )
    );

    setText(
        "reportProfit",
        formatCurrency(
            report.profit
        )
    );

    setText(
        "reportItemsSold",
        formatNumber(
            report.itemsSold
        )
    );

    setText(
        "reportItemsPurchased",
        formatNumber(
            report.itemsPurchased
        )
    );

    setText(
        "reportCurrentStock",
        formatNumber(
            getCurrentStock()
        )
    );

    setText(
        "profitSales",
        formatCurrency(
            report.totalSales
        )
    );

    const totalCost =
        report.totalSales -
        report.profit;

    setText(
        "profitCost",
        formatCurrency(totalCost)
    );

    setText(
        "profitTotal",
        formatCurrency(
            report.profit
        )
    );

    updateReportChart(report);
}

function updateReportChart(report) {
    const chart =
        document.getElementById(
            "purchaseSalesChart"
        );

    if (!chart) {
        return;
    }

    const purchase =
        report.totalPurchase;

    const sales =
        report.totalSales;

    const maxValue =
        Math.max(
            purchase,
            sales,
            1
        );

    const purchaseHeight =
        Math.max(
            5,
            (purchase / maxValue) * 100
        );

    const salesHeight =
        Math.max(
            5,
            (sales / maxValue) * 100
        );

    chart.innerHTML = `
        <div class="chart-bars report-chart-bars">
            <div class="chart-column">
                <div class="chart-value">
                    ${formatCurrency(
                        purchase
                    )}
                </div>

                <div
                    class="chart-bar"
                    style="height:${purchaseHeight}%"
                ></div>

                <div class="chart-label">
                    Purchase
                </div>
            </div>

            <div class="chart-column">
                <div class="chart-value">
                    ${formatCurrency(
                        sales
                    )}
                </div>

                <div
                    class="chart-bar"
                    style="height:${salesHeight}%"
                ></div>

                <div class="chart-label">
                    Sales
                </div>
            </div>
        </div>
    `;
}
function updateStockTotal() {
    const quantity =
        Number(
            document.getElementById(
                "stockQuantity"
            )?.value
        ) || 0;

    const price =
        Number(
            document.getElementById(
                "purchasePrice"
            )?.value
        ) || 0;

    const total =
        quantity * price;

    setText(
        "stockTotalAmount",
        formatCurrency(total)
    );
}

function updateSaleCalculations() {
    const quantity =
        Number(
            document.getElementById(
                "saleQuantity"
            )?.value
        ) || 0;

    const sellingPrice =
        Number(
            document.getElementById(
                "sellingPrice"
            )?.value
        ) || 0;

    const currentStock =
        getCurrentStock();

    const averageCost =
        getAveragePurchasePrice();

    const totalAmount =
        quantity * sellingPrice;

    const profit =
        quantity *
        (sellingPrice - averageCost);

    setText(
        "saleCurrentStock",
        formatNumber(currentStock)
    );

    setText(
        "saleTotalAmount",
        formatCurrency(totalAmount)
    );

    setText(
        "saleProfitAmount",
        formatCurrency(profit)
    );
}

async function handleStockSubmit(event) {
    event.preventDefault();

    const date =
        document.getElementById(
            "stockDate"
        )?.value || getToday();

    const quantity =
        Number(
            document.getElementById(
                "stockQuantity"
            )?.value
        ) || 0;

    const unitPrice =
        Number(
            document.getElementById(
                "purchasePrice"
            )?.value
        ) || 0;

    const supplier =
        document.getElementById(
            "stockSupplier"
        )?.value.trim() || "";

    const reference =
        document.getElementById(
            "stockReference"
        )?.value.trim() || "";

    const notes =
        document.getElementById(
            "stockNotes"
        )?.value.trim() || "";

    if (!date) {
        alert("Please select a date.");
        return;
    }

    if (quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    if (unitPrice < 0) {
        alert("Please enter a valid purchase price.");
        return;
    }

    try {
        const response =
            await fetch(
                `${API_BASE_URL}/purchases`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        date,
                        quantity,
                        unit_price:
                            unitPrice,
                        supplier,
                        reference,
                        notes
                    })
                }
            );

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.error ||
                "Failed to save purchase"
            );
        }

        await loadPurchasesFromBackend();

        closeModal("stockModal");

        resetStockForm();

        updateAll();

        alert(
            "Stock added successfully."
        );
    } catch (error) {
        console.error(error);

        alert(
            "Unable to save purchase. Make sure the backend is running."
        );
    }
}

async function handleSaleSubmit(event) {
    event.preventDefault();

    const date =
        document.getElementById(
            "saleDate"
        )?.value || getToday();

    const quantity =
        Number(
            document.getElementById(
                "saleQuantity"
            )?.value
        ) || 0;

    const sellingPrice =
        Number(
            document.getElementById(
                "sellingPrice"
            )?.value
        ) || 0;

    const paymentMethod =
        document.getElementById(
            "paymentMethod"
        )?.value || "";

    const reference =
        document.getElementById(
            "saleReference"
        )?.value.trim() || "";

    const notes =
        document.getElementById(
            "saleNotes"
        )?.value.trim() || "";

    const currentStock =
        getCurrentStock();

    if (!date) {
        alert("Please select a date.");
        return;
    }

    if (quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    if (quantity > currentStock) {
        alert(
            `You cannot sell ${quantity} pieces. Current stock is ${currentStock} pieces.`
        );
        return;
    }

    if (sellingPrice < 0) {
        alert("Please enter a valid selling price.");
        return;
    }

    try {
        const response =
            await fetch(
                `${API_BASE_URL}/sales`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        date,
                        quantity,
                        unit_price:
                            sellingPrice,
                        payment_method:
                            paymentMethod,
                        reference,
                        notes
                    })
                }
            );

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.error ||
                "Failed to save sale"
            );
        }

        await loadSalesFromBackend();

        closeModal("saleModal");

        resetSaleForm();

        updateAll();

        alert(
            "Sale recorded successfully."
        );
    } catch (error) {
        console.error(error);

        alert(
            error.message ||
            "Unable to save sale. Make sure the backend is running."
        );
    }
}

function handleAdjustmentSubmit(event) {
    event.preventDefault();

    const date = getToday();

    const type =
        document.getElementById(
            "adjustmentType"
        )?.value || "add";

    const quantity =
        Number(
            document.getElementById(
                "adjustmentQuantity"
            )?.value
        ) || 0;

    const reason =
        document.getElementById(
            "adjustmentReason"
        )?.value.trim() || "";

    const notes =
        document.getElementById(
            "adjustmentNotes"
        )?.value.trim() || "";

    if (quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    const signedQuantity =
        type === "remove"
            ? -quantity
            : quantity;

    if (
        signedQuantity < 0 &&
        Math.abs(signedQuantity) >
            getCurrentStock()
    ) {
        alert(
            "Adjustment quantity cannot be greater than current stock."
        );
        return;
    }

    data.adjustments.push({
        id: generateId(
            "adjustment"
        ),
        date,
        createdAt: Date.now(),
        quantity: signedQuantity,
        reason,
        notes
    });

    saveData();

    closeModal(
        "adjustmentModal"
    );

    resetAdjustmentForm();

    updateAll();

    alert(
        "Stock adjustment saved successfully."
    );
}

async function deletePurchase(id) {
    const confirmed =
        confirm(
            "Are you sure you want to delete this purchase?"
        );

    if (!confirmed) {
        return;
    }

    try {
        const response =
            await fetch(
                `${API_BASE_URL}/purchases/${id}`,
                {
                    method: "DELETE"
                }
            );

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.error ||
                "Failed to delete purchase"
            );
        }

        await loadPurchasesFromBackend();

        updateAll();

        alert(
            "Purchase deleted successfully."
        );
    } catch (error) {
        console.error(error);

        alert(
            error.message ||
            "Unable to delete purchase."
        );
    }
}

async function deleteSale(id) {
    const confirmed =
        confirm(
            "Are you sure you want to delete this sale?"
        );

    if (!confirmed) {
        return;
    }

    try {
        const response =
            await fetch(
                `${API_BASE_URL}/sales/${id}`,
                {
                    method: "DELETE"
                }
            );

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.error ||
                "Failed to delete sale"
            );
        }

        await loadSalesFromBackend();

        updateAll();

        alert(
            "Sale deleted successfully."
        );
    } catch (error) {
        console.error(error);

        alert(
            error.message ||
            "Unable to delete sale."
        );
    }
}

function openModal(id) {
    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    modal.classList.add("show");

    modal.style.display = "flex";
}

function closeModal(id) {
    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    modal.classList.remove("show");

    modal.style.display = "none";
}

function resetStockForm() {
    const form =
        document.getElementById(
            "stockForm"
        );

    if (form) {
        form.reset();
    }

    const stockDate =
        document.getElementById(
            "stockDate"
        );

    if (stockDate) {
        stockDate.value = getToday();
    }

    updateStockTotal();
}

function resetSaleForm() {
    const form =
        document.getElementById(
            "saleForm"
        );

    if (form) {
        form.reset();
    }

    const saleDate =
        document.getElementById(
            "saleDate"
        );

    if (saleDate) {
        saleDate.value = getToday();
    }

    updateSaleCalculations();
}

function resetAdjustmentForm() {
    const form =
        document.getElementById(
            "adjustmentForm"
        );

    if (form) {
        form.reset();
    }
}

function loadSettingsIntoForm() {
    const storeName =
        document.getElementById(
            "storeName"
        );

    const storePhone =
        document.getElementById(
            "storePhone"
        );

    const storeAddress =
        document.getElementById(
            "storeAddress"
        );

    const defaultPurchasePrice =
        document.getElementById(
            "defaultPurchasePrice"
        );

    const defaultSellingPrice =
        document.getElementById(
            "defaultSellingPrice"
        );

    const lowStockLimit =
        document.getElementById(
            "lowStockLimit"
        );

    if (storeName) {
        storeName.value =
            data.settings.storeName;
    }

    if (storePhone) {
        storePhone.value =
            data.settings.phone;
    }

    if (storeAddress) {
        storeAddress.value =
            data.settings.address;
    }

    if (defaultPurchasePrice) {
        defaultPurchasePrice.value =
            data.settings.purchasePrice;
    }

    if (defaultSellingPrice) {
        defaultSellingPrice.value =
            data.settings.sellingPrice;
    }

    if (lowStockLimit) {
        lowStockLimit.value =
            data.settings.lowStockLimit;
    }
}

function saveGeneralSettings() {
    const storeName =
        document.getElementById(
            "storeName"
        )?.value.trim() || "Tracker";

    const phone =
        document.getElementById(
            "storePhone"
        )?.value.trim() || "";

    const address =
        document.getElementById(
            "storeAddress"
        )?.value.trim() || "";

    data.settings.storeName =
        storeName;

    data.settings.phone =
        phone;

    data.settings.address =
        address;

    saveData();

    updateAll();

    alert(
        "Store settings saved successfully."
    );
}

function saveInventorySettings() {
    const purchasePrice =
        Number(
            document.getElementById(
                "defaultPurchasePrice"
            )?.value
        ) || 0;

    const sellingPrice =
        Number(
            document.getElementById(
                "defaultSellingPrice"
            )?.value
        ) || 0;

    const lowStockLimit =
        Number(
            document.getElementById(
                "lowStockLimit"
            )?.value
        ) || 0;

    if (purchasePrice < 0) {
        alert(
            "Purchase price cannot be negative."
        );
        return;
    }

    if (sellingPrice < 0) {
        alert(
            "Selling price cannot be negative."
        );
        return;
    }

    if (lowStockLimit < 0) {
        alert(
            "Low stock limit cannot be negative."
        );
        return;
    }

    data.settings.purchasePrice =
        purchasePrice;

    data.settings.sellingPrice =
        sellingPrice;

    data.settings.lowStockLimit =
        lowStockLimit;

    saveData();

    updateAll();

    alert(
        "Inventory settings saved successfully."
    );
}

function setDefaultPurchasePrice() {
    const field =
        document.getElementById(
            "purchasePrice"
        );

    if (
        field &&
        !field.value &&
        Number(data.settings.purchasePrice) > 0
    ) {
        field.value =
            data.settings.purchasePrice;
    }

    updateStockTotal();
}

function setDefaultSellingPrice() {
    const field =
        document.getElementById(
            "sellingPrice"
        );

    if (
        field &&
        !field.value &&
        Number(data.settings.sellingPrice) > 0
    ) {
        field.value =
            data.settings.sellingPrice;
    }

    updateSaleCalculations();
}

function setupModalEvents() {
    const stockModalClose =
        document.getElementById(
            "stockModalClose"
        );

    const stockModalCancel =
        document.getElementById(
            "stockModalCancel"
        );

    const saleModalClose =
        document.getElementById(
            "saleModalClose"
        );

    const saleModalCancel =
        document.getElementById(
            "saleModalCancel"
        );

    const adjustmentModalClose =
        document.getElementById(
            "adjustmentModalClose"
        );

    const adjustmentModalCancel =
        document.getElementById(
            "adjustmentModalCancel"
        );

    stockModalClose?.addEventListener(
        "click",
        () => closeModal("stockModal")
    );

    stockModalCancel?.addEventListener(
        "click",
        () => closeModal("stockModal")
    );

    saleModalClose?.addEventListener(
        "click",
        () => closeModal("saleModal")
    );

    saleModalCancel?.addEventListener(
        "click",
        () => closeModal("saleModal")
    );

    adjustmentModalClose?.addEventListener(
        "click",
        () =>
            closeModal(
                "adjustmentModal"
            )
    );

    adjustmentModalCancel?.addEventListener(
        "click",
        () =>
            closeModal(
                "adjustmentModal"
            )
    );

    document
        .getElementById("addStockBtn")
        ?.addEventListener(
            "click",
            () => {
                resetStockForm();
                setDefaultPurchasePrice();
                openModal("stockModal");
            }
        );

    document
        .getElementById("addSaleBtn")
        ?.addEventListener(
            "click",
            () => {
                resetSaleForm();
                setDefaultSellingPrice();
                updateSaleCalculations();
                openModal("saleModal");
            }
        );

    document
        .getElementById(
            "stockAdjustmentBtn"
        )
        ?.addEventListener(
            "click",
            () => {
                resetAdjustmentForm();
                openModal(
                    "adjustmentModal"
                );
            }
        );

    document
        .getElementById("stockForm")
        ?.addEventListener(
            "submit",
            handleStockSubmit
        );

    document
        .getElementById("saleForm")
        ?.addEventListener(
            "submit",
            handleSaleSubmit
        );

    document
        .getElementById(
            "adjustmentForm"
        )
        ?.addEventListener(
            "submit",
            handleAdjustmentSubmit
        );

    document
        .getElementById("stockQuantity")
        ?.addEventListener(
            "input",
            updateStockTotal
        );

    document
        .getElementById("purchasePrice")
        ?.addEventListener(
            "input",
            updateStockTotal
        );

    document
        .getElementById("saleQuantity")
        ?.addEventListener(
            "input",
            updateSaleCalculations
        );

    document
        .getElementById("sellingPrice")
        ?.addEventListener(
            "input",
            updateSaleCalculations
        );
}

function setupFilters() {
    const purchaseFromDate =
        document.getElementById(
            "purchaseFromDate"
        );

    const purchaseToDate =
        document.getElementById(
            "purchaseToDate"
        );

    const salesFromDate =
        document.getElementById(
            "salesFromDate"
        );

    const salesToDate =
        document.getElementById(
            "salesToDate"
        );

    const reportFromDate =
        document.getElementById(
            "reportFromDate"
        );

    const reportToDate =
        document.getElementById(
            "reportToDate"
        );

    purchaseFromDate?.addEventListener(
        "change",
        renderPurchasePage
    );

    purchaseToDate?.addEventListener(
        "change",
        renderPurchasePage
    );

    salesFromDate?.addEventListener(
        "change",
        renderSalesPage
    );

    salesToDate?.addEventListener(
        "change",
        renderSalesPage
    );

    reportFromDate?.addEventListener(
        "change",
        updateReports
    );

    reportToDate?.addEventListener(
        "change",
        updateReports
    );

    document
        .getElementById(
            "dashboardPeriod"
        )
        ?.addEventListener(
            "change",
            () => {
                updateDashboardPeriod();
                updateSalesChart();
            }
        );
}

function setupSettings() {
    document
        .getElementById(
            "saveSettingsBtn"
        )
        ?.addEventListener(
            "click",
            saveGeneralSettings
        );

    document
        .getElementById(
            "saveInventorySettings"
        )
        ?.addEventListener(
            "click",
            saveInventorySettings
        );
}

function setupNavbar() {
    const menuButton =
        document.getElementById(
            "menuButton"
        );

    const nav =
        document.querySelector(
            ".navbar-nav"
        );

    if (!menuButton || !nav) {
        return;
    }

    menuButton.addEventListener(
        "click",
        () => {
            nav.classList.toggle(
                "show"
            );

            menuButton.classList.toggle(
                "active"
            );
        }
    );

    nav
        .querySelectorAll("a")
        .forEach(link => {
            link.addEventListener(
                "click",
                () => {
                    nav.classList.remove(
                        "show"
                    );

                    menuButton.classList.remove(
                        "active"
                    );
                }
            );
        });
}

function setupReportExport() {
    const button =
        document.getElementById(
            "exportReportBtn"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        exportReport
    );
}

function exportReport() {
    const fromDate =
        document.getElementById(
            "reportFromDate"
        )?.value || "";

    const toDate =
        document.getElementById(
            "reportToDate"
        )?.value || "";

    const report =
        getReportData(
            fromDate,
            toDate
        );

    const rows = [
        [
            "Tracker Report"
        ],
        [
            `From: ${
                fromDate || "-"
            }`
        ],
        [
            `To: ${
                toDate || "-"
            }`
        ],
        [],
        [
            "Metric",
            "Value"
        ],
        [
            "Total Purchase",
            report.totalPurchase
        ],
        [
            "Total Sales",
            report.totalSales
        ],
        [
            "Total Profit",
            report.profit
        ],
        [
            "Items Purchased",
            report.itemsPurchased
        ],
        [
            "Items Sold",
            report.itemsSold
        ],
        [
            "Current Stock",
            getCurrentStock()
        ]
    ];

    const csv =
        rows.map(row =>
            row.map(value => {
                const text =
                    String(
                        value ?? ""
                    );

                return `"${text.replace(
                    /"/g,
                    '""'
                )}"`;
            }).join(",")
        ).join("\n");

    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        `tracker-report-${getToday()}.csv`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
}

function setupNavigation() {
    const links =
        document.querySelectorAll(
            "[data-section]"
        );

    links.forEach(link => {
        link.addEventListener(
            "click",
            () => {
                links.forEach(item => {
                    item.classList.remove(
                        "active"
                    );
                });

                link.classList.add(
                    "active"
                );
            }
        );
    });
}

function updateAll() {
    updateDashboard();

    renderStockPage();

    renderPurchasePage();

    renderSalesPage();

    updateReports();

    loadSettingsIntoForm();

    updateStockTotal();

    updateSaleCalculations();
}

async function initializeApp() {
    initializeDates();

    setupModalEvents();

    setupFilters();

    setupSettings();

    setupNavbar();

    setupReportExport();

    setupNavigation();

    await loadPurchasesFromBackend();

    await loadSalesFromBackend();

    updateAll();
}

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);