const STORAGE_KEY = "trackerData";

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
            purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
            sales: Array.isArray(parsed.sales) ? parsed.sales : [],
            adjustments: Array.isArray(parsed.adjustments) ? parsed.adjustments : [],
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

function generateId(prefix = "item") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
    let value = quantity * (Number(data.settings.purchasePrice) || 0);

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
                value -= Math.min(event.quantity, quantity) * averageCost;
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
                const averageCost = quantity > 0
                    ? value / quantity
                    : Number(data.settings.purchasePrice) || 0;

                quantity += event.quantity;
                value += event.quantity * averageCost;
            } else if (event.quantity < 0) {
                const removeQuantity = Math.min(
                    Math.abs(event.quantity),
                    quantity
                );

                const averageCost = quantity > 0
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
        (total, item) => total + (Number(item.totalAmount) || 0),
        0
    );
}

function getTotalSales() {
    return data.sales.reduce(
        (total, item) => total + (Number(item.totalAmount) || 0),
        0
    );
}

function getTotalItemsPurchased() {
    return data.purchases.reduce(
        (total, item) => total + (Number(item.quantity) || 0),
        0
    );
}

function getTotalItemsSold() {
    return data.sales.reduce(
        (total, item) => total + (Number(item.quantity) || 0),
        0
    );
}

function getSaleCost(saleId) {
    let quantity = Number(data.openingStock) || 0;
    let value = quantity * (Number(data.settings.purchasePrice) || 0);
    let saleCost = 0;

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

                saleCost += cost;
                value -= Math.min(event.quantity, quantity) * averageCost;
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
                const averageCost = quantity > 0
                    ? value / quantity
                    : Number(data.settings.purchasePrice) || 0;

                quantity += event.quantity;
                value += event.quantity * averageCost;
            } else if (event.quantity < 0) {
                const removeQuantity = Math.min(
                    Math.abs(event.quantity),
                    quantity
                );

                const averageCost = quantity > 0
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

    return saleCost;
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
            (total, item) => total + (Number(item.totalAmount) || 0),
            0
        );
}

function getTodayPurchase() {
    const today = getToday();

    return data.purchases
        .filter(item => isSameDate(item.date, today))
        .reduce(
            (total, item) => total + (Number(item.totalAmount) || 0),
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

    const purchaseFromDate = document.getElementById("purchaseFromDate");
    const purchaseToDate = document.getElementById("purchaseToDate");

    if (purchaseToDate && !purchaseToDate.value) {
        purchaseToDate.value = today;
    }

    if (purchaseFromDate && !purchaseFromDate.value) {
        const date = new Date();
        date.setDate(date.getDate() - 30);

        purchaseFromDate.value = date.toISOString().split("T")[0];
    }

    const salesFromDate = document.getElementById("salesFromDate");
    const salesToDate = document.getElementById("salesToDate");

    if (salesToDate && !salesToDate.value) {
        salesToDate.value = today;
    }

    if (salesFromDate && !salesFromDate.value) {
        const date = new Date();
        date.setDate(date.getDate() - 30);

        salesFromDate.value = date.toISOString().split("T")[0];
    }

    const reportToDate = document.getElementById("reportToDate");
    const reportFromDate = document.getElementById("reportFromDate");

    if (reportToDate && !reportToDate.value) {
        reportToDate.value = today;
    }

    if (reportFromDate && !reportFromDate.value) {
        const date = new Date();
        date.setDate(date.getDate() - 30);

        reportFromDate.value = date.toISOString().split("T")[0];
    }
}

function updateDashboard() {
    const currentStock = getCurrentStock();
    const totalPurchase = getTotalPurchase();
    const totalSales = getTotalSales();
    const totalProfit = getTotalProfit();

    setText("currentStock", formatNumber(currentStock));
    setText("totalPurchase", formatCurrency(totalPurchase));
    setText("totalSales", formatCurrency(totalSales));
    setText("totalProfit", formatCurrency(totalProfit));

    setText("todaySales", formatCurrency(getTodaySales()));
    setText("todayPurchase", formatCurrency(getTodayPurchase()));

    setText(
        "totalItemsPurchased",
        formatNumber(getTotalItemsPurchased())
    );

    setText(
        "totalItemsSold",
        formatNumber(getTotalItemsSold())
    );

    setText("openingStock", formatNumber(data.openingStock));
    setText(
        "summaryStockIn",
        formatNumber(getTotalItemsPurchased())
    );
    setText(
        "summaryStockOut",
        formatNumber(getTotalItemsSold())
    );
    setText(
        "summaryCurrentStock",
        formatNumber(currentStock)
    );

    const currentDate = document.getElementById("currentDate");

    if (currentDate) {
        currentDate.textContent = formatDate(getToday());
    }

    updateLowStockAlert();
    updateSalesChart();
    renderRecentActivity();
}

function updateLowStockAlert() {
    const alertBox = document.getElementById("lowStockAlert");

    if (!alertBox) {
        return;
    }

    const currentStock = getCurrentStock();
    const limit = Number(data.settings.lowStockLimit) || 0;

    if (currentStock <= limit) {
        alertBox.classList.remove("hidden");

        alertBox.innerHTML = `
            <strong>Low Stock</strong>
            <span>Current stock is ${formatNumber(currentStock)} pieces. Your low stock limit is ${formatNumber(limit)} pieces.</span>
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
        date.setDate(date.getDate() - i);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        days.push({
            date: `${year}-${month}-${day}`,
            label: date.toLocaleDateString("en-IN", {
                weekday: "short"
            })
        });
    }

    return days;
}

function updateSalesChart() {
    const chart = document.getElementById("salesChart");

    if (!chart) {
        return;
    }

    const days = getLastSevenDays();

    const values = days.map(day => {
        return data.sales
            .filter(sale => sale.date === day.date)
            .reduce(
                (total, sale) =>
                    total + (Number(sale.totalAmount) || 0),
                0
            );
    });

    const maxValue = Math.max(...values, 1);

    chart.innerHTML = `
        <div class="chart-bars">
            ${values.map((value, index) => {
                const height = Math.max(
                    5,
                    (value / maxValue) * 100
                );

                return `
                    <div class="chart-column">
                        <div class="chart-value">${formatCurrency(value)}</div>
                        <div class="chart-bar" style="height:${height}%"></div>
                        <div class="chart-label">${days[index].label}</div>
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
            description: `Purchased ${formatNumber(item.quantity)} pieces`,
            amount: Number(item.totalAmount) || 0
        });
    });

    data.sales.forEach(item => {
        activities.push({
            date: item.date,
            createdAt: item.createdAt || 0,
            type: "Sale",
            description: `Sold ${formatNumber(item.quantity)} pieces`,
            amount: Number(item.totalAmount) || 0
        });
    });

    data.adjustments.forEach(item => {
        activities.push({
            date: item.date,
            createdAt: item.createdAt || 0,
            type: "Adjustment",
            description: `${item.quantity >= 0 ? "Added" : "Removed"} ${formatNumber(Math.abs(item.quantity))} pieces`,
            amount: 0
        });
    });

    return activities.sort((a, b) => {
        const dateCompare = String(b.date).localeCompare(String(a.date));

        if (dateCompare !== 0) {
            return dateCompare;
        }

        return Number(b.createdAt) - Number(a.createdAt);
    });
}

function renderRecentActivity() {
    const container = document.getElementById("recentActivity");

    if (!container) {
        return;
    }

    const activities = getActivityList().slice(0, 8);

    if (!activities.length) {
        container.innerHTML = `
            <tr>
                <td colspan="4">No recent activity</td>
            </tr>
        `;

        return;
    }

    container.innerHTML = activities.map(activity => `
        <tr>
            <td>${formatDate(activity.date)}</td>
            <td>${activity.type}</td>
            <td>${activity.description}</td>
            <td>${activity.amount ? formatCurrency(activity.amount) : "-"}</td>
        </tr>
    `).join("");
}
function renderStockPage() {
    const currentStock = getCurrentStock();
    const stockValue = getStockValue();
    const averageCost = getAveragePurchasePrice();
    const sellingPrice = Number(data.settings.sellingPrice) || 0;
    const potentialProfit = (sellingPrice - averageCost) * currentStock;

    setText("stockPageQuantity", formatNumber(currentStock));
    setText("stockPurchaseValue", formatCurrency(stockValue));
    setText(
        "stockSalesValue",
        formatCurrency(currentStock * sellingPrice)
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
        `${formatNumber(data.settings.lowStockLimit)} pieces`
    );

    setText(
        "detailStockValue",
        formatCurrency(stockValue)
    );

    updateStockStatus();
    renderStockMovements();
}

function updateStockStatus() {
    const status = document.getElementById("stockStatus");

    if (!status) {
        return;
    }

    const stock = getCurrentStock();
    const limit = Number(data.settings.lowStockLimit) || 0;

    if (stock <= 0) {
        status.textContent = "Out of Stock";
        status.className = "stock-status danger";
    } else if (stock <= limit) {
        status.textContent = "Low Stock";
        status.className = "stock-status warning";
    } else {
        status.textContent = "In Stock";
        status.className = "stock-status success";
    }
}

function renderStockMovements() {
    const table = document.getElementById("stockMovementTable");

    if (!table) {
        return;
    }

    const movements = [];

    data.purchases.forEach(item => {
        movements.push({
            date: item.date,
            createdAt: item.createdAt || 0,
            type: "Stock In",
            quantity: Number(item.quantity) || 0,
            reference: item.reference || item.supplier || "-",
            notes: item.notes || "-"
        });
    });

    data.sales.forEach(item => {
        movements.push({
            date: item.date,
            createdAt: item.createdAt || 0,
            type: "Sale",
            quantity: -(Number(item.quantity) || 0),
            reference: item.reference || "-",
            notes: item.notes || "-"
        });
    });

    data.adjustments.forEach(item => {
        movements.push({
            date: item.date,
            createdAt: item.createdAt || 0,
            type: "Adjustment",
            quantity: Number(item.quantity) || 0,
            reference: item.reason || "-",
            notes: item.notes || "-"
        });
    });

    movements.sort((a, b) => {
        const dateCompare = String(b.date).localeCompare(String(a.date));

        if (dateCompare !== 0) {
            return dateCompare;
        }

        return Number(b.createdAt) - Number(a.createdAt);
    });

    if (!movements.length) {
        table.innerHTML = `
            <tr>
                <td colspan="5">No stock movement found</td>
            </tr>
        `;

        return;
    }

    table.innerHTML = movements.map(item => `
        <tr>
            <td>${formatDate(item.date)}</td>
            <td>${item.type}</td>
            <td class="${item.quantity >= 0 ? "text-success" : "text-danger"}">
                ${item.quantity >= 0 ? "+" : ""}${formatNumber(item.quantity)}
            </td>
            <td>${item.reference}</td>
            <td>${item.notes}</td>
        </tr>
    `).join("");
}

function renderPurchasePage() {
    const purchases = getFilteredPurchases();

    const totalQuantity = purchases.reduce(
        (total, item) =>
            total + (Number(item.quantity) || 0),
        0
    );

    const totalAmount = purchases.reduce(
        (total, item) =>
            total + (Number(item.totalAmount) || 0),
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
        document.getElementById("purchaseFromDate")?.value || "";

    const toDate =
        document.getElementById("purchaseToDate")?.value || "";

    return data.purchases
        .filter(item => {
            if (fromDate && item.date < fromDate) {
                return false;
            }

            if (toDate && item.date > toDate) {
                return false;
            }

            return true;
        })
        .sort((a, b) => {
            const dateCompare =
                String(b.date).localeCompare(String(a.date));

            if (dateCompare !== 0) {
                return dateCompare;
            }

            return Number(b.createdAt) - Number(a.createdAt);
        });
}

function renderPurchaseTable(purchases) {
    const table = document.getElementById("purchaseTable");

    if (!table) {
        return;
    }

    if (!purchases.length) {
        table.innerHTML = `
            <tr>
                <td colspan="8">No purchase records found</td>
            </tr>
        `;

        return;
    }

    table.innerHTML = purchases.map(item => `
        <tr>
            <td>${formatDate(item.date)}</td>
            <td>${formatNumber(item.quantity)}</td>
            <td>${formatCurrency(item.unitPrice)}</td>
            <td>${formatCurrency(item.totalAmount)}</td>
            <td>${item.supplier || "-"}</td>
            <td>${item.reference || "-"}</td>
            <td>${item.notes || "-"}</td>
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

    table.querySelectorAll("[data-purchase-delete]").forEach(button => {
        button.addEventListener("click", () => {
            deletePurchase(button.dataset.purchaseDelete);
        });
    });
}

function renderSalesPage() {
    const sales = getFilteredSales();

    const totalQuantity = sales.reduce(
        (total, item) =>
            total + (Number(item.quantity) || 0),
        0
    );

    const totalAmount = sales.reduce(
        (total, item) =>
            total + (Number(item.totalAmount) || 0),
        0
    );

    const totalProfit = sales.reduce((total, item) => {
        const revenue = Number(item.totalAmount) || 0;
        const cost = getSaleCost(item.id);

        return total + revenue - cost;
    }, 0);

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
        document.getElementById("salesFromDate")?.value || "";

    const toDate =
        document.getElementById("salesToDate")?.value || "";

    return data.sales
        .filter(item => {
            if (fromDate && item.date < fromDate) {
                return false;
            }

            if (toDate && item.date > toDate) {
                return false;
            }

            return true;
        })
        .sort((a, b) => {
            const dateCompare =
                String(b.date).localeCompare(String(a.date));

            if (dateCompare !== 0) {
                return dateCompare;
            }

            return Number(b.createdAt) - Number(a.createdAt);
        });
}

function renderSalesTable(sales) {
    const table = document.getElementById("salesTable");

    if (!table) {
        return;
    }

    if (!sales.length) {
        table.innerHTML = `
            <tr>
                <td colspan="9">No sales records found</td>
            </tr>
        `;

        return;
    }

    table.innerHTML = sales.map(item => {
        const revenue = Number(item.totalAmount) || 0;
        const cost = getSaleCost(item.id);
        const profit = revenue - cost;

        return `
            <tr>
                <td>${formatDate(item.date)}</td>
                <td>${formatNumber(item.quantity)}</td>
                <td>${formatCurrency(item.unitPrice)}</td>
                <td>${formatCurrency(revenue)}</td>
                <td>${formatCurrency(cost)}</td>
                <td>${formatCurrency(profit)}</td>
                <td>${item.paymentMethod || "-"}</td>
                <td>${item.reference || "-"}</td>
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

    table.querySelectorAll("[data-sale-delete]").forEach(button => {
        button.addEventListener("click", () => {
            deleteSale(button.dataset.saleDelete);
        });
    });
}

function getReportData(fromDate, toDate) {
    const purchases = data.purchases.filter(item => {
        return (
            (!fromDate || item.date >= fromDate) &&
            (!toDate || item.date <= toDate)
        );
    });

    const sales = data.sales.filter(item => {
        return (
            (!fromDate || item.date >= fromDate) &&
            (!toDate || item.date <= toDate)
        );
    });

    const totalPurchase = purchases.reduce(
        (total, item) =>
            total + (Number(item.totalAmount) || 0),
        0
    );

    const totalSales = sales.reduce(
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

    const profit = sales.reduce((total, item) => {
        const revenue = Number(item.totalAmount) || 0;
        const cost = getSaleCost(item.id);

        return total + revenue - cost;
    }, 0);

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
        document.getElementById("reportFromDate")?.value || "";

    const toDate =
        document.getElementById("reportToDate")?.value || "";

    const report = getReportData(fromDate, toDate);

    setText(
        "reportPurchase",
        formatCurrency(report.totalPurchase)
    );

    setText(
        "reportSales",
        formatCurrency(report.totalSales)
    );

    setText(
        "reportProfit",
        formatCurrency(report.profit)
    );

    setText(
        "reportItemsSold",
        formatNumber(report.itemsSold)
    );

    setText(
        "reportItemsPurchased",
        formatNumber(report.itemsPurchased)
    );

    setText(
        "reportCurrentStock",
        formatNumber(getCurrentStock())
    );

    setText(
        "profitSales",
        formatCurrency(report.totalSales)
    );

    const totalCost = report.totalSales - report.profit;

    setText(
        "profitCost",
        formatCurrency(totalCost)
    );

    setText(
        "profitTotal",
        formatCurrency(report.profit)
    );

    updateReportChart(report);
}

function updateReportChart(report) {
    const chart = document.getElementById("purchaseSalesChart");

    if (!chart) {
        return;
    }

    const purchase = report.totalPurchase;
    const sales = report.totalSales;
    const maxValue = Math.max(purchase, sales, 1);

    const purchaseHeight =
        Math.max(5, (purchase / maxValue) * 100);

    const salesHeight =
        Math.max(5, (sales / maxValue) * 100);

    chart.innerHTML = `
        <div class="chart-bars report-chart-bars">
            <div class="chart-column">
                <div class="chart-value">
                    ${formatCurrency(purchase)}
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
                    ${formatCurrency(sales)}
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

function loadSettings() {
    const storeName =
        document.getElementById("storeName");

    const storePhone =
        document.getElementById("storePhone");

    const storeAddress =
        document.getElementById("storeAddress");

    const purchasePrice =
        document.getElementById("defaultPurchasePrice");

    const sellingPrice =
        document.getElementById("defaultSellingPrice");

    const lowStockLimit =
        document.getElementById("lowStockLimit");

    if (storeName) {
        storeName.value =
            data.settings.storeName || "";
    }

    if (storePhone) {
        storePhone.value =
            data.settings.phone || "";
    }

    if (storeAddress) {
        storeAddress.value =
            data.settings.address || "";
    }

    if (purchasePrice) {
        purchasePrice.value =
            data.settings.purchasePrice || "";
    }

    if (sellingPrice) {
        sellingPrice.value =
            data.settings.sellingPrice || "";
    }

    if (lowStockLimit) {
        lowStockLimit.value =
            data.settings.lowStockLimit || "";
    }
}

function saveStoreSettings() {
    const storeName =
        document.getElementById("storeName");

    const storePhone =
        document.getElementById("storePhone");

    const storeAddress =
        document.getElementById("storeAddress");

    data.settings.storeName =
        storeName?.value.trim() || "Tracker";

    data.settings.phone =
        storePhone?.value.trim() || "";

    data.settings.address =
        storeAddress?.value.trim() || "";

    saveData();

    alert("Store settings saved successfully.");

    updateAll();
}

function saveInventorySettingsHandler() {
    const purchasePrice =
        document.getElementById("defaultPurchasePrice");

    const sellingPrice =
        document.getElementById("defaultSellingPrice");

    const lowStockLimit =
        document.getElementById("lowStockLimit");

    data.settings.purchasePrice =
        Math.max(0, Number(purchasePrice?.value) || 0);

    data.settings.sellingPrice =
        Math.max(0, Number(sellingPrice?.value) || 0);

    data.settings.lowStockLimit =
        Math.max(0, Number(lowStockLimit?.value) || 0);

    saveData();

    alert("Inventory settings saved successfully.");

    updateAll();
}

function openModal(id) {
    const modal = document.getElementById(id);

    if (modal) {
        modal.classList.add("show");
        modal.classList.remove("hidden");
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);

    if (modal) {
        modal.classList.remove("show");
        modal.classList.add("hidden");
    }
}

function resetStockForm() {
    const form = document.getElementById("stockForm");

    if (form) {
        form.reset();
    }

    const date = document.getElementById("stockDate");

    if (date) {
        date.value = getToday();
    }

    const purchasePrice =
        document.getElementById("purchasePrice");

    if (purchasePrice) {
        purchasePrice.value =
            data.settings.purchasePrice || "";
    }

    updateStockTotal();
}

function resetSaleForm() {
    const form = document.getElementById("saleForm");

    if (form) {
        form.reset();
    }

    const date = document.getElementById("saleDate");

    if (date) {
        date.value = getToday();
    }

    const sellingPrice =
        document.getElementById("sellingPrice");

    if (sellingPrice) {
        sellingPrice.value =
            data.settings.sellingPrice || "";
    }

    updateSaleCalculations();
}

function resetAdjustmentForm() {
    const form = document.getElementById("adjustmentForm");

    if (form) {
        form.reset();
    }
}

function updateStockTotal() {
    const quantity =
        Number(document.getElementById("stockQuantity")?.value) || 0;

    const price =
        Number(document.getElementById("purchasePrice")?.value) || 0;

    const total =
        quantity * price;

    setText(
        "stockTotalAmount",
        formatCurrency(total)
    );
}

function updateSaleCalculations() {
    const quantity =
        Number(document.getElementById("saleQuantity")?.value) || 0;

    const price =
        Number(document.getElementById("sellingPrice")?.value) || 0;

    const currentStock =
        getCurrentStock();

    const total =
        quantity * price;

    const averageCost =
        getAveragePurchasePrice();

    const profit =
        quantity * (price - averageCost);

    setText(
        "saleCurrentStock",
        formatNumber(currentStock)
    );

    setText(
        "saleTotalAmount",
        formatCurrency(total)
    );

    setText(
        "saleProfitAmount",
        formatCurrency(profit)
    );
}

function handleStockSubmit(event) {
    event.preventDefault();

    const date =
        document.getElementById("stockDate")?.value;

    const quantity =
        Number(document.getElementById("stockQuantity")?.value);

    const purchasePrice =
        Number(document.getElementById("purchasePrice")?.value);

    const supplier =
        document.getElementById("stockSupplier")?.value.trim() || "";

    const reference =
        document.getElementById("stockReference")?.value.trim() || "";

    const notes =
        document.getElementById("stockNotes")?.value.trim() || "";

    if (!date) {
        alert("Please select a date.");
        return;
    }

    if (!quantity || quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    if (purchasePrice < 0 || Number.isNaN(purchasePrice)) {
        alert("Please enter a valid purchase price.");
        return;
    }

    const totalAmount =
        quantity * purchasePrice;

    data.purchases.push({
        id: generateId("purchase"),
        date,
        createdAt: Date.now(),
        quantity,
        unitPrice: purchasePrice,
        totalAmount,
        supplier,
        reference,
        notes
    });

    saveData();

    closeModal("stockModal");
    resetStockForm();
    updateAll();

    alert("Stock added successfully.");
}

function handleSaleSubmit(event) {
    event.preventDefault();

    const date =
        document.getElementById("saleDate")?.value;

    const quantity =
        Number(document.getElementById("saleQuantity")?.value);

    const sellingPrice =
        Number(document.getElementById("sellingPrice")?.value);

    const paymentMethod =
        document.getElementById("paymentMethod")?.value || "";

    const reference =
        document.getElementById("saleReference")?.value.trim() || "";

    const notes =
        document.getElementById("saleNotes")?.value.trim() || "";

    const currentStock =
        getCurrentStock();

    if (!date) {
        alert("Please select a date.");
        return;
    }

    if (!quantity || quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    if (quantity > currentStock) {
        alert(
            `You cannot sell ${quantity} pieces. Current stock is ${currentStock} pieces.`
        );

        return;
    }

    if (sellingPrice < 0 || Number.isNaN(sellingPrice)) {
        alert("Please enter a valid selling price.");
        return;
    }

    const totalAmount =
        quantity * sellingPrice;

    const averageCost =
        getAveragePurchasePrice();

    const costAmount =
        quantity * averageCost;

    const profit =
        totalAmount - costAmount;

    data.sales.push({
        id: generateId("sale"),
        date,
        createdAt: Date.now(),
        quantity,
        unitPrice: sellingPrice,
        totalAmount,
        costAmount,
        profit,
        paymentMethod,
        reference,
        notes
    });

    saveData();

    closeModal("saleModal");
    resetSaleForm();
    updateAll();

    alert("Sale recorded successfully.");
}

function handleAdjustmentSubmit(event) {
    event.preventDefault();

    const type =
        document.getElementById("adjustmentType")?.value || "add";

    const quantity =
        Number(document.getElementById("adjustmentQuantity")?.value);

    const reason =
        document.getElementById("adjustmentReason")?.value.trim() || "";

    const notes =
        document.getElementById("adjustmentNotes")?.value.trim() || "";

    const currentStock =
        getCurrentStock();

    if (!quantity || quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    const signedQuantity =
        type === "remove"
            ? -quantity
            : quantity;

    if (
        signedQuantity < 0 &&
        quantity > currentStock
    ) {
        alert(
            `You cannot remove ${quantity} pieces. Current stock is ${currentStock} pieces.`
        );

        return;
    }

    data.adjustments.push({
        id: generateId("adjustment"),
        date: getToday(),
        createdAt: Date.now(),
        quantity: signedQuantity,
        reason,
        notes
    });

    saveData();

    closeModal("adjustmentModal");
    resetAdjustmentForm();
    updateAll();

    alert("Stock adjustment saved successfully.");
}
function deletePurchase(id) {
    const purchase = data.purchases.find(
        item => item.id === id
    );

    if (!purchase) {
        return;
    }

    const confirmed = confirm(
        "Are you sure you want to delete this purchase record?"
    );

    if (!confirmed) {
        return;
    }

    data.purchases = data.purchases.filter(
        item => item.id !== id
    );

    saveData();
    updateAll();

    alert("Purchase record deleted.");
}

function deleteSale(id) {
    const sale = data.sales.find(
        item => item.id === id
    );

    if (!sale) {
        return;
    }

    const confirmed = confirm(
        "Are you sure you want to delete this sale record?"
    );

    if (!confirmed) {
        return;
    }

    data.sales = data.sales.filter(
        item => item.id !== id
    );

    saveData();
    updateAll();

    alert("Sale record deleted.");
}

function setupModalEvents() {
    const stockModal = document.getElementById("stockModal");
    const saleModal = document.getElementById("saleModal");
    const adjustmentModal =
        document.getElementById("adjustmentModal");

    const stockModalClose =
        document.getElementById("stockModalClose");

    const stockModalCancel =
        document.getElementById("stockModalCancel");

    const saleModalClose =
        document.getElementById("saleModalClose");

    const saleModalCancel =
        document.getElementById("saleModalCancel");

    const adjustmentModalClose =
        document.getElementById("adjustmentModalClose");

    const adjustmentModalCancel =
        document.getElementById("adjustmentModalCancel");

    const addStockBtn =
        document.getElementById("addStockBtn");

    const addSaleBtn =
        document.getElementById("addSaleBtn");

    const stockAdjustmentBtn =
        document.getElementById("stockAdjustmentBtn");

    if (addStockBtn) {
        addStockBtn.addEventListener("click", () => {
            resetStockForm();
            openModal("stockModal");
        });
    }

    if (addSaleBtn) {
        addSaleBtn.addEventListener("click", () => {
            resetSaleForm();
            openModal("saleModal");
        });
    }

    if (stockAdjustmentBtn) {
        stockAdjustmentBtn.addEventListener("click", () => {
            resetAdjustmentForm();
            openModal("adjustmentModal");
        });
    }

    if (stockModalClose) {
        stockModalClose.addEventListener("click", () => {
            closeModal("stockModal");
        });
    }

    if (stockModalCancel) {
        stockModalCancel.addEventListener("click", () => {
            closeModal("stockModal");
        });
    }

    if (saleModalClose) {
        saleModalClose.addEventListener("click", () => {
            closeModal("saleModal");
        });
    }

    if (saleModalCancel) {
        saleModalCancel.addEventListener("click", () => {
            closeModal("saleModal");
        });
    }

    if (adjustmentModalClose) {
        adjustmentModalClose.addEventListener("click", () => {
            closeModal("adjustmentModal");
        });
    }

    if (adjustmentModalCancel) {
        adjustmentModalCancel.addEventListener("click", () => {
            closeModal("adjustmentModal");
        });
    }

    [stockModal, saleModal, adjustmentModal].forEach(modal => {
        if (!modal) {
            return;
        }

        modal.addEventListener("click", event => {
            if (event.target === modal) {
                modal.classList.remove("show");
                modal.classList.add("hidden");
            }
        });
    });

    const stockForm =
        document.getElementById("stockForm");

    const saleForm =
        document.getElementById("saleForm");

    const adjustmentForm =
        document.getElementById("adjustmentForm");

    if (stockForm) {
        stockForm.addEventListener(
            "submit",
            handleStockSubmit
        );
    }

    if (saleForm) {
        saleForm.addEventListener(
            "submit",
            handleSaleSubmit
        );
    }

    if (adjustmentForm) {
        adjustmentForm.addEventListener(
            "submit",
            handleAdjustmentSubmit
        );
    }

    const stockQuantity =
        document.getElementById("stockQuantity");

    const purchasePrice =
        document.getElementById("purchasePrice");

    const saleQuantity =
        document.getElementById("saleQuantity");

    const sellingPrice =
        document.getElementById("sellingPrice");

    if (stockQuantity) {
        stockQuantity.addEventListener(
            "input",
            updateStockTotal
        );
    }

    if (purchasePrice) {
        purchasePrice.addEventListener(
            "input",
            updateStockTotal
        );
    }

    if (saleQuantity) {
        saleQuantity.addEventListener(
            "input",
            updateSaleCalculations
        );
    }

    if (sellingPrice) {
        sellingPrice.addEventListener(
            "input",
            updateSaleCalculations
        );
    }
}

function setupFilters() {
    const purchaseFromDate =
        document.getElementById("purchaseFromDate");

    const purchaseToDate =
        document.getElementById("purchaseToDate");

    const salesFromDate =
        document.getElementById("salesFromDate");

    const salesToDate =
        document.getElementById("salesToDate");

    const reportFromDate =
        document.getElementById("reportFromDate");

    const reportToDate =
        document.getElementById("reportToDate");

    [
        purchaseFromDate,
        purchaseToDate
    ].forEach(field => {
        if (field) {
            field.addEventListener(
                "change",
                renderPurchasePage
            );
        }
    });

    [
        salesFromDate,
        salesToDate
    ].forEach(field => {
        if (field) {
            field.addEventListener(
                "change",
                renderSalesPage
            );
        }
    });

    [
        reportFromDate,
        reportToDate
    ].forEach(field => {
        if (field) {
            field.addEventListener(
                "change",
                updateReports
            );
        }
    });

    const generateReportBtn =
        document.getElementById("generateReportBtn");

    if (generateReportBtn) {
        generateReportBtn.addEventListener(
            "click",
            updateReports
        );
    }
}

function setupSettings() {
    const saveSettingsBtn =
        document.getElementById("saveSettingsBtn");

    const saveInventorySettings =
        document.getElementById("saveInventorySettings");

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener(
            "click",
            saveStoreSettings
        );
    }

    if (saveInventorySettings) {
        saveInventorySettings.addEventListener(
            "click",
            saveInventorySettingsHandler
        );
    }
}

function setupNavbar() {
    const menuToggle =
        document.getElementById("menuToggle");

    const navMenu =
        document.getElementById("navMenu");

    if (menuToggle && navMenu) {
        menuToggle.addEventListener("click", () => {
            navMenu.classList.toggle("show");

            const expanded =
                navMenu.classList.contains("show");

            menuToggle.setAttribute(
                "aria-expanded",
                expanded ? "true" : "false"
            );
        });
    }

    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
            document
                .querySelectorAll(".nav-link")
                .forEach(item => {
                    item.classList.remove("active");
                });

            link.classList.add("active");

            if (navMenu) {
                navMenu.classList.remove("show");
            }

            if (menuToggle) {
                menuToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        });
    });
}

function setupReportExport() {
    const exportButton =
        document.getElementById("exportReportBtn");

    if (!exportButton) {
        return;
    }

    exportButton.addEventListener("click", () => {
        const fromDate =
            document.getElementById("reportFromDate")?.value || "";

        const toDate =
            document.getElementById("reportToDate")?.value || "";

        const report =
            getReportData(fromDate, toDate);

        const rows = [
            [
                "Tracker Report",
                "",
                "",
                ""
            ],
            [
                "From",
                fromDate || "-",
                "To",
                toDate || "-"
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

        const csv = rows
            .map(row =>
                row.map(value => {
                    const text = String(value ?? "");

                    return `"${text.replace(/"/g, '""')}"`
                }).join(",")
            )
            .join("\n");

        const blob = new Blob(
            [csv],
            {
                type: "text/csv;charset=utf-8;"
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
    });
}

function setupNavigation() {
    const links =
        document.querySelectorAll(".nav-link");

    links.forEach(link => {
        link.addEventListener("click", event => {
            const target =
                link.getAttribute("href");

            if (!target || target === "#") {
                event.preventDefault();
            }
        });
    });
}

function updateAll() {
    updateDashboard();
    renderStockPage();
    renderPurchasePage();
    renderSalesPage();
    updateReports();
    loadSettings();
}

document.addEventListener("DOMContentLoaded", () => {
    initializeDates();
    setupModalEvents();
    setupFilters();
    setupSettings();
    setupNavbar();
    setupReportExport();
    setupNavigation();
    updateAll();
});