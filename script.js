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
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
        return structuredClone(defaultData);
    }

    try {
        const parsed = JSON.parse(saved);

        return {
            ...defaultData,
            ...parsed,
            settings: {
                ...defaultData.settings,
                ...(parsed.settings || {})
            }
        };
    } catch {
        return structuredClone(defaultData);
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function formatCurrency(value) {
    return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(date) {
    if (!date) return "-";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) return date;

    return d.toLocaleDateString("en-GB");
}

function getToday() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getCurrentStock() {
    const purchases = data.purchases.reduce(
        (total, item) => total + Number(item.quantity),
        0
    );

    const sales = data.sales.reduce(
        (total, item) => total + Number(item.quantity),
        0
    );

    const adjustments = data.adjustments.reduce(
        (total, item) => total + Number(item.quantity),
        0
    );

    return Number(data.openingStock) + purchases - sales + adjustments;
}

function getTotalPurchase() {
    return data.purchases.reduce(
        (total, item) => total + Number(item.totalAmount),
        0
    );
}

function getTotalSales() {
    return data.sales.reduce(
        (total, item) => total + Number(item.totalAmount),
        0
    );
}

function getTotalItemsPurchased() {
    return data.purchases.reduce(
        (total, item) => total + Number(item.quantity),
        0
    );
}

function getTotalItemsSold() {
    return data.sales.reduce(
        (total, item) => total + Number(item.quantity),
        0
    );
}

function getAveragePurchasePrice() {
    const quantity = getTotalItemsPurchased();

    if (quantity <= 0) {
        return Number(data.settings.purchasePrice) || 0;
    }

    return getTotalPurchase() / quantity;
}

function getTotalCostOfSoldItems() {
    return data.sales.reduce((total, sale) => {
        return total + Number(sale.costAmount || 0);
    }, 0);
}

function getTotalProfit() {
    return getTotalSales() - getTotalCostOfSoldItems();
}

function getStockValue() {
    return getCurrentStock() * getAveragePurchasePrice();
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function initializeDates() {
    const today = getToday();

    const dateInputs = [
        "stockDate",
        "saleDate"
    ];

    dateInputs.forEach(id => {
        const input = document.getElementById(id);

        if (input && !input.value) {
            input.value = today;
        }
    });

    const fromInputs = [
        "purchaseFromDate",
        "salesFromDate",
        "reportFromDate"
    ];

    fromInputs.forEach(id => {
        const input = document.getElementById(id);

        if (input && !input.value) {
            const date = new Date();
            date.setDate(date.getDate() - 30);

            input.value = date.toISOString().split("T")[0];
        }
    });

    const toInputs = [
        "purchaseToDate",
        "salesToDate",
        "reportToDate"
    ];

    toInputs.forEach(id => {
        const input = document.getElementById(id);

        if (input && !input.value) {
            input.value = today;
        }
    });
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

    const today = getToday();

    const todaySales = data.sales
        .filter(item => item.date === today)
        .reduce((total, item) => total + Number(item.totalAmount), 0);

    const todayPurchase = data.purchases
        .filter(item => item.date === today)
        .reduce((total, item) => total + Number(item.totalAmount), 0);

    setText("todaySales", formatCurrency(todaySales));
    setText("todayPurchase", formatCurrency(todayPurchase));
    setText("totalItemsPurchased", formatNumber(getTotalItemsPurchased()));
    setText("totalItemsSold", formatNumber(getTotalItemsSold()));

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

    updateLowStockAlert();
    updateRecentActivity();
    updateSalesChart();
}

function updateLowStockAlert() {
    const alert = document.getElementById("lowStockAlert");

    if (!alert) return;

    const stock = getCurrentStock();
    const limit = Number(data.settings.lowStockLimit) || 0;

    if (stock <= limit) {
        alert.classList.add("show");

        const message = alert.querySelector("[data-low-stock-message]");

        if (message) {
            message.textContent = `Current stock is ${formatNumber(stock)} pieces. Low stock limit is ${formatNumber(limit)} pieces.`;
        } else {
            alert.innerHTML = `
                <strong>Low Stock Alert</strong>
                <span>Current stock is ${formatNumber(stock)} pieces. Low stock limit is ${formatNumber(limit)} pieces.</span>
            `;
        }
    } else {
        alert.classList.remove("show");
    }
}

function updateRecentActivity() {
    const table = document.getElementById("recentActivity");

    if (!table) return;

    const activities = [];

    data.purchases.forEach(item => {
        activities.push({
            date: item.date,
            type: "Stock In",
            quantity: Number(item.quantity),
            amount: Number(item.totalAmount),
            reference: item.reference || "-"
        });
    });

    data.sales.forEach(item => {
        activities.push({
            date: item.date,
            type: "Sale",
            quantity: Number(item.quantity),
            amount: Number(item.totalAmount),
            reference: item.reference || "-"
        });
    });

    data.adjustments.forEach(item => {
        activities.push({
            date: item.date,
            type: "Adjustment",
            quantity: Number(item.quantity),
            amount: 0,
            reference: item.reason || "-"
        });
    });

    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    const latest = activities.slice(0, 8);

    if (!latest.length) {
        table.innerHTML = `
            <tr>
                <td colspan="5">No activity yet.</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = latest.map(item => {
        const quantity = item.quantity > 0
            ? `+${formatNumber(item.quantity)}`
            : formatNumber(item.quantity);

        return `
            <tr>
                <td>${formatDate(item.date)}</td>
                <td>${item.type}</td>
                <td>${quantity}</td>
                <td>${item.amount ? formatCurrency(item.amount) : "-"}</td>
                <td>${item.reference}</td>
            </tr>
        `;
    }).join("");
}

function updateStockPage() {
    const stock = getCurrentStock();
    const purchaseValue = getStockValue();
    const salesValue = stock * (Number(data.settings.sellingPrice) || 0);
    const potentialProfit = salesValue - purchaseValue;

    setText("stockPageQuantity", formatNumber(stock));
    setText("stockPurchaseValue", formatCurrency(purchaseValue));
    setText("stockSalesValue", formatCurrency(salesValue));
    setText("potentialProfit", formatCurrency(potentialProfit));

    setText("detailCurrentStock", formatNumber(stock));
    setText(
        "detailPurchasePrice",
        formatCurrency(getAveragePurchasePrice())
    );
    setText(
        "detailSellingPrice",
        formatCurrency(data.settings.sellingPrice)
    );
    setText(
        "detailLowStock",
        formatNumber(data.settings.lowStockLimit)
    );
    setText("detailStockValue", formatCurrency(purchaseValue));

    const status = document.getElementById("stockStatus");

    if (status) {
        if (stock <= Number(data.settings.lowStockLimit)) {
            status.textContent = "Low Stock";
            status.className = "stock-status danger";
        } else {
            status.textContent = "In Stock";
            status.className = "stock-status success";
        }
    }

    updateStockMovementTable();
}

function updateStockMovementTable() {
    const table = document.getElementById("stockMovementTable");

    if (!table) return;

    const movements = [];

    data.purchases.forEach(item => {
        movements.push({
            date: item.date,
            type: "Stock In",
            quantity: `+${item.quantity}`,
            reference: item.reference || "-",
            notes: item.notes || "-"
        });
    });

    data.sales.forEach(item => {
        movements.push({
            date: item.date,
            type: "Sale",
            quantity: `-${item.quantity}`,
            reference: item.reference || "-",
            notes: item.notes || "-"
        });
    });

    data.adjustments.forEach(item => {
        movements.push({
            date: item.date,
            type: "Adjustment",
            quantity: item.quantity > 0
                ? `+${item.quantity}`
                : item.quantity,
            reference: item.reason || "-",
            notes: item.notes || "-"
        });
    });

    movements.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!movements.length) {
        table.innerHTML = `
            <tr>
                <td colspan="5">No stock movements yet.</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = movements.map(item => `
        <tr>
            <td>${formatDate(item.date)}</td>
            <td>${item.type}</td>
            <td>${formatNumber(item.quantity)}</td>
            <td>${item.reference}</td>
            <td>${item.notes}</td>
        </tr>
    `).join("");
}

function updatePurchasePage() {
    setText(
        "stockInQuantity",
        formatNumber(getTotalItemsPurchased())
    );

    setText(
        "stockInAmount",
        formatCurrency(getTotalPurchase())
    );

    renderPurchaseTable();
}

function renderPurchaseTable() {
    const table = document.getElementById("purchaseTable");

    if (!table) return;

    const from = document.getElementById("purchaseFromDate")?.value;
    const to = document.getElementById("purchaseToDate")?.value;

    let purchases = [...data.purchases];

    if (from) {
        purchases = purchases.filter(item => item.date >= from);
    }

    if (to) {
        purchases = purchases.filter(item => item.date <= to);
    }

    purchases.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!purchases.length) {
        table.innerHTML = `
            <tr>
                <td colspan="7">No purchase records found.</td>
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
            <td>
                <button class="table-delete" onclick="deletePurchase('${item.id}')">
                    Delete
                </button>
            </td>
        </tr>
    `).join("");
}

function updateSalesPage() {
    setText(
        "salesQuantity",
        formatNumber(getTotalItemsSold())
    );

    setText(
        "salesAmount",
        formatCurrency(getTotalSales())
    );

    setText(
        "salesProfit",
        formatCurrency(getTotalProfit())
    );

    renderSalesTable();
}

function renderSalesTable() {
    const table = document.getElementById("salesTable");

    if (!table) return;

    const from = document.getElementById("salesFromDate")?.value;
    const to = document.getElementById("salesToDate")?.value;

    let sales = [...data.sales];

    if (from) {
        sales = sales.filter(item => item.date >= from);
    }

    if (to) {
        sales = sales.filter(item => item.date <= to);
    }

    sales.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!sales.length) {
        table.innerHTML = `
            <tr>
                <td colspan="8">No sales records found.</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = sales.map(item => `
        <tr>
            <td>${formatDate(item.date)}</td>
            <td>${formatNumber(item.quantity)}</td>
            <td>${formatCurrency(item.unitPrice)}</td>
            <td>${formatCurrency(item.totalAmount)}</td>
            <td>${formatCurrency(item.costAmount)}</td>
            <td>${formatCurrency(item.profit)}</td>
            <td>${item.paymentMethod || "-"}</td>
            <td>
                <button class="table-delete" onclick="deleteSale('${item.id}')">
                    Delete
                </button>
            </td>
        </tr>
    `).join("");
}

function updateReports() {
    const from = document.getElementById("reportFromDate")?.value;
    const to = document.getElementById("reportToDate")?.value;

    let purchases = [...data.purchases];
    let sales = [...data.sales];

    if (from) {
        purchases = purchases.filter(item => item.date >= from);
        sales = sales.filter(item => item.date >= from);
    }

    if (to) {
        purchases = purchases.filter(item => item.date <= to);
        sales = sales.filter(item => item.date <= to);
    }

    const purchaseAmount = purchases.reduce(
        (total, item) => total + Number(item.totalAmount),
        0
    );

    const salesAmount = sales.reduce(
        (total, item) => total + Number(item.totalAmount),
        0
    );

    const profit = sales.reduce(
        (total, item) => total + Number(item.profit),
        0
    );

    const itemsSold = sales.reduce(
        (total, item) => total + Number(item.quantity),
        0
    );

    const itemsPurchased = purchases.reduce(
        (total, item) => total + Number(item.quantity),
        0
    );

    setText("reportPurchase", formatCurrency(purchaseAmount));
    setText("reportSales", formatCurrency(salesAmount));
    setText("reportProfit", formatCurrency(profit));
    setText("reportItemsSold", formatNumber(itemsSold));
    setText("reportItemsPurchased", formatNumber(itemsPurchased));
    setText("reportCurrentStock", formatNumber(getCurrentStock()));

    setText("profitSales", formatCurrency(salesAmount));

    const cost = sales.reduce(
        (total, item) => total + Number(item.costAmount),
        0
    );

    setText("profitCost", formatCurrency(cost));
    setText("profitTotal", formatCurrency(profit));

    updateReportChart(purchases, sales);
}

function updateSalesChart() {
    const chart = document.getElementById("salesChart");

    if (!chart) return;

    const sales = data.sales.reduce(
        (total, item) => total + Number(item.totalAmount),
        0
    );

    const purchases = data.purchases.reduce(
        (total, item) => total + Number(item.totalAmount),
        0
    );

    chart.innerHTML = `
        <div class="chart-placeholder-content">
            <strong>Sales Overview</strong>
            <span>Sales: ${formatCurrency(sales)}</span>
            <span>Purchase: ${formatCurrency(purchases)}</span>
        </div>
    `;
}

function updateReportChart(purchases, sales) {
    const chart = document.getElementById("purchaseSalesChart");

    if (!chart) return;

    const purchaseAmount = purchases.reduce(
        (total, item) => total + Number(item.totalAmount),
        0
    );

    const salesAmount = sales.reduce(
        (total, item) => total + Number(item.totalAmount),
        0
    );

    chart.innerHTML = `
        <div class="chart-placeholder-content">
            <strong>Purchase vs Sales</strong>
            <span>Purchase: ${formatCurrency(purchaseAmount)}</span>
            <span>Sales: ${formatCurrency(salesAmount)}</span>
        </div>
    `;
}

function loadSettings() {
    setInputValue("storeName", data.settings.storeName);
    setInputValue("storePhone", data.settings.phone);
    setInputValue("storeAddress", data.settings.address);

    setInputValue(
        "defaultPurchasePrice",
        data.settings.purchasePrice
    );

    setInputValue(
        "defaultSellingPrice",
        data.settings.sellingPrice
    );

    setInputValue(
        "lowStockLimit",
        data.settings.lowStockLimit
    );
}

function setInputValue(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.value = value ?? "";
    }
}

function saveStoreSettings() {
    data.settings.storeName =
        document.getElementById("storeName")?.value.trim() || "Tracker";

    data.settings.phone =
        document.getElementById("storePhone")?.value.trim() || "";

    data.settings.address =
        document.getElementById("storeAddress")?.value.trim() || "";

    saveData();

    alert("Store settings saved successfully.");
}

function saveInventorySettings() {
    data.settings.purchasePrice =
        Number(document.getElementById("defaultPurchasePrice")?.value) || 0;

    data.settings.sellingPrice =
        Number(document.getElementById("defaultSellingPrice")?.value) || 0;

    data.settings.lowStockLimit =
        Number(document.getElementById("lowStockLimit")?.value) || 0;

    saveData();

    updateAll();

    alert("Inventory settings saved successfully.");
}

function openModal(id) {
    const modal = document.getElementById(id);

    if (modal) {
        modal.classList.add("show");
        document.body.classList.add("modal-open");
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);

    if (modal) {
        modal.classList.remove("show");
        document.body.classList.remove("modal-open");
    }
}

function setupModals() {
    document.getElementById("addStockBtn")?.addEventListener("click", () => {
        resetStockForm();
        openModal("stockModal");
    });

    document.getElementById("stockAdjustmentBtn")?.addEventListener("click", () => {
        resetAdjustmentForm();
        openModal("adjustmentModal");
    });

    document.getElementById("addSaleBtn")?.addEventListener("click", () => {
        const stock = getCurrentStock();

        if (stock <= 0) {
            alert("There is no stock available for sale.");
            return;
        }

        resetSaleForm();
        openModal("saleModal");
    });

    document.getElementById("stockModalClose")?.addEventListener("click", () => {
        closeModal("stockModal");
    });

    document.getElementById("stockModalCancel")?.addEventListener("click", () => {
        closeModal("stockModal");
    });

    document.getElementById("saleModalClose")?.addEventListener("click", () => {
        closeModal("saleModal");
    });

    document.getElementById("saleModalCancel")?.addEventListener("click", () => {
        closeModal("saleModal");
    });

    document.getElementById("adjustmentModalClose")?.addEventListener("click", () => {
        closeModal("adjustmentModal");
    });

    document.getElementById("adjustmentModalCancel")?.addEventListener("click", () => {
        closeModal("adjustmentModal");
    });

    window.addEventListener("click", event => {
        if (event.target.id === "stockModal") {
            closeModal("stockModal");
        }

        if (event.target.id === "saleModal") {
            closeModal("saleModal");
        }

        if (event.target.id === "adjustmentModal") {
            closeModal("adjustmentModal");
        }
    });
}

function resetStockForm() {
    document.getElementById("stockForm")?.reset();

    setInputValue("stockDate", getToday());
    setInputValue(
        "purchasePrice",
        data.settings.purchasePrice
    );

    updateStockTotal();
}

function resetSaleForm() {
    document.getElementById("saleForm")?.reset();

    setInputValue("saleDate", getToday());
    setInputValue(
        "sellingPrice",
        data.settings.sellingPrice
    );

    setText(
        "saleCurrentStock",
        formatNumber(getCurrentStock())
    );

    updateSaleTotal();
}

function resetAdjustmentForm() {
    document.getElementById("adjustmentForm")?.reset();
}

function updateStockTotal() {
    const quantity =
        Number(document.getElementById("stockQuantity")?.value) || 0;

    const price =
        Number(document.getElementById("purchasePrice")?.value) || 0;

    setText(
        "stockTotalAmount",
        formatCurrency(quantity * price)
    );
}

function updateSaleTotal() {
    const quantity =
        Number(document.getElementById("saleQuantity")?.value) || 0;

    const price =
        Number(document.getElementById("sellingPrice")?.value) || 0;

    const total = quantity * price;
    const cost = quantity * getAveragePurchasePrice();
    const profit = total - cost;

    setText("saleTotalAmount", formatCurrency(total));
    setText("saleProfitAmount", formatCurrency(profit));
}

function handleStockSubmit(event) {
    event.preventDefault();

    const date =
        document.getElementById("stockDate")?.value || getToday();

    const quantity =
        Number(document.getElementById("stockQuantity")?.value) || 0;

    const unitPrice =
        Number(document.getElementById("purchasePrice")?.value) || 0;

    const supplier =
        document.getElementById("stockSupplier")?.value.trim() || "";

    const reference =
        document.getElementById("stockReference")?.value.trim() || "";

    const notes =
        document.getElementById("stockNotes")?.value.trim() || "";

    if (quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    if (unitPrice < 0) {
        alert("Please enter a valid purchase price.");
        return;
    }

    const purchase = {
        id: generateId("PUR"),
        date,
        quantity,
        unitPrice,
        totalAmount: quantity * unitPrice,
        supplier,
        reference,
        notes
    };

    data.purchases.push(purchase);

    saveData();
    closeModal("stockModal");
    updateAll();
    renderPurchaseTable();

    alert("Stock added successfully.");
}

function handleSaleSubmit(event) {
    event.preventDefault();

    const date =
        document.getElementById("saleDate")?.value || getToday();

    const quantity =
        Number(document.getElementById("saleQuantity")?.value) || 0;

    const unitPrice =
        Number(document.getElementById("sellingPrice")?.value) || 0;

    const paymentMethod =
        document.getElementById("paymentMethod")?.value || "";

    const reference =
        document.getElementById("saleReference")?.value.trim() || "";

    const notes =
        document.getElementById("saleNotes")?.value.trim() || "";

    const currentStock = getCurrentStock();

    if (quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    if (quantity > currentStock) {
        alert(`Only ${currentStock} pieces are currently available.`);
        return;
    }

    if (unitPrice < 0) {
        alert("Please enter a valid selling price.");
        return;
    }

    const totalAmount = quantity * unitPrice;
    const costAmount = quantity * getAveragePurchasePrice();
    const profit = totalAmount - costAmount;

    const sale = {
        id: generateId("SAL"),
        date,
        quantity,
        unitPrice,
        totalAmount,
        costAmount,
        profit,
        paymentMethod,
        reference,
        notes
    };

    data.sales.push(sale);

    saveData();
    closeModal("saleModal");
    updateAll();
    renderSalesTable();

    alert("Sale recorded successfully.");
}

function handleAdjustmentSubmit(event) {
    event.preventDefault();

    const type =
        document.getElementById("adjustmentType")?.value || "add";

    const quantity =
        Number(document.getElementById("adjustmentQuantity")?.value) || 0;

    const reason =
        document.getElementById("adjustmentReason")?.value.trim() || "";

    const notes =
        document.getElementById("adjustmentNotes")?.value.trim() || "";

    if (quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    const adjustmentQuantity =
        type === "remove" ? -quantity : quantity;

    if (
        type === "remove" &&
        quantity > getCurrentStock()
    ) {
        alert("Adjustment quantity cannot be greater than current stock.");
        return;
    }

    data.adjustments.push({
        id: generateId("ADJ"),
        date: getToday(),
        quantity: adjustmentQuantity,
        reason,
        notes
    });

    saveData();
    closeModal("adjustmentModal");
    updateAll();

    alert("Stock adjustment saved successfully.");
}

function deletePurchase(id) {
    const purchase = data.purchases.find(item => item.id === id);

    if (!purchase) return;

    if (!confirm("Delete this purchase record?")) {
        return;
    }

    data.purchases = data.purchases.filter(item => item.id !== id);

    saveData();
    updateAll();
}

function deleteSale(id) {
    const sale = data.sales.find(item => item.id === id);

    if (!sale) return;

    if (!confirm("Delete this sales record?")) {
        return;
    }

    data.sales = data.sales.filter(item => item.id !== id);

    saveData();
    updateAll();
}

function setupForms() {
    document.getElementById("stockForm")?.addEventListener(
        "submit",
        handleStockSubmit
    );

    document.getElementById("saleForm")?.addEventListener(
        "submit",
        handleSaleSubmit
    );

    document.getElementById("adjustmentForm")?.addEventListener(
        "submit",
        handleAdjustmentSubmit
    );

    document.getElementById("stockQuantity")?.addEventListener(
        "input",
        updateStockTotal
    );

    document.getElementById("purchasePrice")?.addEventListener(
        "input",
        updateStockTotal
    );

    document.getElementById("saleQuantity")?.addEventListener(
        "input",
        updateSaleTotal
    );

    document.getElementById("sellingPrice")?.addEventListener(
        "input",
        updateSaleTotal
    );

    document.getElementById("purchaseFromDate")?.addEventListener(
        "change",
        renderPurchaseTable
    );

    document.getElementById("purchaseToDate")?.addEventListener(
        "change",
        renderPurchaseTable
    );

    document.getElementById("salesFromDate")?.addEventListener(
        "change",
        renderSalesTable
    );

    document.getElementById("salesToDate")?.addEventListener(
        "change",
        renderSalesTable
    );

    document.getElementById("generateReportBtn")?.addEventListener(
        "click",
        updateReports
    );

    document.getElementById("saveSettingsBtn")?.addEventListener(
        "click",
        saveStoreSettings
    );

    document.getElementById("saveInventorySettings")?.addEventListener(
        "click",
        saveInventorySettings
    );
}

function setupNavbar() {
    const menuToggle = document.getElementById("menuToggle");
    const navMenu = document.getElementById("navMenu");

    menuToggle?.addEventListener("click", () => {
        navMenu?.classList.toggle("open");
        menuToggle.classList.toggle("active");
    });

    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".nav-link").forEach(item => {
                item.classList.remove("active");
            });

            link.classList.add("active");

            navMenu?.classList.remove("open");
            menuToggle?.classList.remove("active");
        });
    });
}

function updateAll() {
    updateDashboard();
    updateStockPage();
    updatePurchasePage();
    updateSalesPage();
    updateReports();
}

document.addEventListener("DOMContentLoaded", () => {
    initializeDates();
    loadSettings();
    setupNavbar();
    setupModals();
    setupForms();
    updateAll();
});