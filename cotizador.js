// DOM Elements
const workspace = document.getElementById('workspace');
const recordCount = document.getElementById('recordCount');
const catalogList = document.getElementById('catalogList');
const aiSearch = document.getElementById('aiSearch');
const clearSearch = document.getElementById('clearSearch');
const aiIndicator = document.getElementById('aiIndicator');
const quoteItemsContainer = document.getElementById('quoteItems');
const quoteSummary = document.getElementById('quoteSummary');
const subtotalVal = document.getElementById('subtotalVal');
const taxVal = document.getElementById('taxVal');
const totalVal = document.getElementById('totalVal');
const aiModal = document.getElementById('aiModal');
const exportQuoteBtn = document.getElementById('exportQuote');
const exportWppBtn = document.getElementById('exportWpp');

// Nuevos Elementos
const currencyToggle = document.getElementById('currencyToggle');
const clientNameInput = document.getElementById('clientName');
const clientCompanyInput = document.getElementById('clientCompany');
const authorNameInput = document.getElementById('authorName');

// IA Mode Elements
const btnModeManual = document.getElementById('btnModeManual');
const btnModeAI = document.getElementById('btnModeAI');
const modeSelectionOverlay = document.getElementById('modeSelectionOverlay');
const bgVideo = document.getElementById('bgVideo');
const videoSource = document.getElementById('videoSource');
const catalogTitle = document.getElementById('catalogTitle');
const aiPromptArea = document.getElementById('aiPromptArea');
const aiPromptInput = document.getElementById('aiPromptInput');
const btnGenerateAI = document.getElementById('btnGenerateAI');
const aiThinkingStatus = document.getElementById('aiThinkingStatus');

// State
let catalogData = []; 
let shoppingCart = []; 
let currentCurrency = 'MXN';
const EXCHANGE_RATE = 15.0; // Factor de conversión a USD

// Precargar Logo PDF
const logoImage = new Image();
logoImage.src = 'logo.png';

// INIT
let appMode = 'MANUAL';
document.addEventListener('DOMContentLoaded', () => {
    aiModal.classList.remove('hidden');
    loadLocalExcel();
    setupEventListeners();
    setupModeSelection();
});

// Auto-Load Excel File
async function loadLocalExcel() {
    try {
        const response = await fetch('1.Productos NODE.xlsx');
        if (!response.ok) throw new Error("No se pudo cargar el archivo");
        
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, {type: 'array'});
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Usar header:1 nos asegura leer las columnas estrictamente como un arreglo (Array) por cada fila
        const jsonArr = XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: false});
        
        if (jsonArr.length < 2) {
            alert("El archivo base está vacío o no tiene suficientes filas.");
            aiModal.classList.add('hidden');
            return;
        }
        
        // Saltar la cabecera
        const dataRows = jsonArr.slice(1);
        
        // Give UI time to breathe
        setTimeout(() => processDataWithAI(dataRows), 1200);
        
    } catch(error) {
        console.error(error);
        alert("Error leyendo el archivo excel predefinido. Probablemente tengas que abrirlo a través de un servidor (Live Server) por las políticas CORS de los navegadores locales.");
        aiModal.classList.add('hidden');
    }
}

// "AI" Data Structure
function processDataWithAI(rows) {
    catalogData = rows
    .filter(row => row && row.length >= 3 && row[1]) // Asegurar que exista al menos el nombre (Columna B)
    .map((row, index) => {
        // Columna C: Precio (índice 2)
        // Quitamos símbolo de dólar, comas (que en MXN son separadores de miles) y espacios
        let rawPrice = String(row[2] || '0').replace(/[$,\s]/g, '');
        let priceNum = parseFloat(rawPrice);

        return {
            id: String(row[0] || '').trim() || generateCyberId(index), // Col A
            name: String(row[1] || '').trim(),                           // Col B
            price: isNaN(priceNum) ? 0 : priceNum,                       // Col C estructurada
            searchString: row.map(v => String(v)).join(' ').toLowerCase()
        };
    });

    finishLoading();
}

function generateCyberId(index) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = 'SKU-';
    for(let i=0; i<4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res + '-' + index;
}

function finishLoading() {
    aiModal.classList.add('hidden');
    
    recordCount.innerText = catalogData.length;
    renderCatalog(catalogData);
}

// Render Engine
function renderCatalog(items) {
    catalogList.innerHTML = '';
    
    if (items.length === 0) {
        catalogList.innerHTML = '<div style="color:var(--text-muted); padding:20px;">No se encontraron resultados del Engine.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    
    const toRender = items.slice(0, 100); 

    toRender.forEach(item => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <span class="prod-code">${item.id}</span>
            <div class="prod-name">${item.name}</div>
            <div class="prod-price">${formatCurrency(item.price)}</div>
            <button class="add-btn" onclick="addToQuote('${item.id}')">
                <i class="ph ph-plus-circle"></i> Añadir
            </button>
        `;
        fragment.appendChild(card);
    });

    catalogList.appendChild(fragment);
}

// Search
let searchTimeout;
aiSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    
    aiIndicator.classList.remove('hidden');
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        aiIndicator.classList.add('hidden');
        if(term.trim() === '') {
            renderCatalog(catalogData);
            return;
        }

        const words = term.split(' ').filter(w => w.length > 0);
        const filtered = catalogData.filter(item => {
            return words.every(w => item.searchString.includes(w));
        });
        
        renderCatalog(filtered);
    }, 300);
});

clearSearch.addEventListener('click', () => {
    aiSearch.value = '';
    renderCatalog(catalogData);
    aiSearch.focus();
});

// Cart Logistics
window.addToQuote = function(id) {
    const item = catalogData.find(p => p.id === id);
    if (!item) return;

    const existing = shoppingCart.find(p => p.id === id);
    if (existing) {
        existing.qty += 1;
    } else {
        shoppingCart.push({ ...item, qty: 1 });
    }
    
    renderCart();
};

window.updateQty = function(id, delta) {
    const item = shoppingCart.find(p => p.id === id);
    if(!item) return;
    
    item.qty += delta;
    if(item.qty <= 0) {
        removeFromQuote(id);
    } else {
        renderCart();
    }
}

window.removeFromQuote = function(id) {
    shoppingCart = shoppingCart.filter(p => p.id !== id);
    renderCart();
}

function renderCart() {
    quoteItemsContainer.innerHTML = '';
    
    if (shoppingCart.length === 0) {
        quoteItemsContainer.innerHTML = '<div class="empty-quote">No hay productos en la cotización</div>';
        quoteSummary.classList.add('hidden');
        exportQuoteBtn.classList.add('hidden');
        exportWppBtn.classList.add('hidden');
        return;
    }
    
    exportQuoteBtn.classList.remove('hidden');
    exportWppBtn.classList.remove('hidden');
    quoteSummary.classList.remove('hidden');

    const fragment = document.createDocumentFragment();
    let subtotal = 0;

    shoppingCart.forEach(item => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;

        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `
            <div class="cart-item-header">
                <div class="cart-item-name">${item.name}</div>
                <button class="remove-btn" onclick="removeFromQuote('${item.id}')"><i class="ph ph-trash"></i></button>
            </div>
            <div class="cart-item-controls">
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateQty('${item.id}', -1)"><i class="ph ph-minus"></i></button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="updateQty('${item.id}', 1)"><i class="ph ph-plus"></i></button>
                </div>
                <div class="cart-item-price">${formatCurrency(itemTotal)}</div>
            </div>
        `;
        fragment.appendChild(el);
    });

    quoteItemsContainer.appendChild(fragment);
    
    const tax = subtotal * 0.16;
    const total = subtotal + tax;
    
    subtotalVal.innerText = formatCurrency(subtotal);
    taxVal.innerText = formatCurrency(tax);
    totalVal.innerText = formatCurrency(total);
}

function formatCurrency(val) {
    let finalVal = currentCurrency === 'USD' ? (val / EXCHANGE_RATE) : val;
    finalVal = Math.ceil(finalVal);
    return new Intl.NumberFormat(currentCurrency === 'MXN' ? 'es-MX' : 'en-US', {
        style: 'currency',
        currency: currentCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(finalVal);
}

function setupEventListeners() {
    exportQuoteBtn.addEventListener('click', generatePDF);
    document.getElementById('finalizeQuote').addEventListener('click', () => {
        alert("Cotización procesada exitosamente en el sistema de pruebas.");
    });

    // Toggle Moneda
    currencyToggle.addEventListener('click', (e) => {
        // Permitir click en switch o en labels
        let newCurr = null;
        if(e.target.classList.contains('curr-label')){
            newCurr = e.target.getAttribute('data-curr');
        } else {
            // switch o slider pulsado: alternar
            newCurr = currentCurrency === 'MXN' ? 'USD' : 'MXN';
        }

        if(newCurr && newCurr !== currentCurrency) {
            currentCurrency = newCurr;
            
            // Actualizar UI Toggle
            if(currentCurrency === 'USD') {
                currencyToggle.classList.add('is-usd');
            } else {
                currencyToggle.classList.remove('is-usd');
            }
            
            Array.from(currencyToggle.querySelectorAll('.curr-label')).forEach(el => {
                if(el.getAttribute('data-curr') === currentCurrency) el.classList.add('active');
                else el.classList.remove('active');
            });

            // Re-renderizar catálogo y carrito con la nueva moneda
            renderCatalog(catalogData);
            renderCart();
        }
    });
}

function generatePDF() {
    if(!window.jspdf) {
        alert("El motor PDF está cargando, revisa tu conexión.");
        return;
    }

    const cName = clientNameInput.value.trim() || 'Cliente No Registrado';
    const cCompany = clientCompanyInput.value.trim() || '';
    const aName = authorNameInput.value.trim() || 'Sistema Automático NODE';
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Insertar Logo Real
    let currentY = 15;
    if (logoImage.complete && logoImage.naturalHeight > 0) {
        const imgWidth = 40; // Ancho máximo
        const imgHeight = (logoImage.naturalHeight / logoImage.naturalWidth) * imgWidth;
        doc.addImage(logoImage, 'PNG', 14, currentY, imgWidth, imgHeight);
    } else {
        // Fallback en caso de que logo.png no se pueda cargar
        doc.setFontSize(26);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 35, 45);
        doc.text("NODE", 14, 25);
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    // Alineado a la derecha
    doc.text("COTIZACIÓN OFICIAL", 140, 21);
    
    // Línea separadora
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    // Ajustar si el logo es muy alto
    const lineY = logoImage.complete && logoImage.naturalHeight > 0 
                  ? 18 + ((logoImage.naturalHeight / logoImage.naturalWidth) * 40)
                  : 32;
                  
    doc.line(14, lineY, 196, lineY);
    
    // Header Info
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, lineY + 7);
    doc.text(`Doc ID: NODE-CTZ-${Math.floor(Math.random()*10000)}`, 14, lineY + 12);
    
    // Client Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Para: ${cName}`, 14, lineY + 20);
    if(cCompany) doc.text(`Empresa: ${cCompany}`, 14, lineY + 25);
    doc.text(`Elaborado por: ${aName}`, 14, cCompany ? lineY + 30 : lineY + 25);
    doc.text(`Moneda Emitida: ${currentCurrency}`, 140, lineY + 20);
    
    const tableColumn = ["ID", "Producto", "Cant", "P.Unitario", "Total"];
    const tableRows = [];

    shoppingCart.forEach(item => {
        const itemTotal = item.price * item.qty;
        tableRows.push([
            item.id,
            item.name.substring(0, 40),
            item.qty.toString(),
            formatCurrency(item.price),
            formatCurrency(itemTotal)
        ]);
    });

    // Ajuste de altura dinámica
    const startY = cCompany ? lineY + 40 : lineY + 35;

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: startY,
        theme: 'grid',
        headStyles: { fillColor: [5, 7, 10], textColor: [0, 243, 255] },
        styles: { fontSize: 9 }
    });

    const finalY = doc.lastAutoTable.finalY || startY;
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Subtotal: ${subtotalVal.innerText}`, 140, finalY + 10);
    doc.text(`IVA (16%): ${taxVal.innerText}`, 140, finalY + 16);
    
    doc.setFontSize(13);
    doc.setTextColor(157, 78, 221);
    doc.text(`TOTAL: ${totalVal.innerText} ${currentCurrency}`, 140, finalY + 24);

    doc.save(`NODE_Cotizacion_${cName.replace(/\s+/g,'_')}.pdf`);
}

function setupModeSelection() {
    btnModeManual.addEventListener('click', () => {
        modeSelectionOverlay.classList.add('hidden');
        appMode = 'MANUAL';
    });

    btnModeAI.addEventListener('click', () => {
        modeSelectionOverlay.classList.add('hidden');
        appMode = 'AI';
        
        // Cambiar a Video de AI
        videoSource.src = 'NODE IA.mp4';
        bgVideo.load();
        
        // Esconder barra manual
        document.querySelector('.ai-search-bar').classList.add('hidden');
        catalogTitle.innerText = "Asistente de Cotización con IA";
        aiPromptArea.classList.remove('hidden');
        catalogList.classList.add('hidden'); // Ocultar lista genérica
    });
}

// Lógica de WhatsApp
exportWppBtn.addEventListener('click', () => {
    if(shoppingCart.length === 0) return;
    
    const cName = clientNameInput.value.trim() || 'No Definido';
    const aName = authorNameInput.value.trim() || 'Sistema Automático NODE';
    
    let text = `*Cotización NODE*\nCliente: ${cName}\nElaborado por: ${aName}\nMoneda: ${currentCurrency}\n\n`;
    shoppingCart.forEach(i => {
        const itemTotal = i.price * i.qty;
        let finalVal = currentCurrency === 'USD' ? (itemTotal / EXCHANGE_RATE) : itemTotal;
        finalVal = Math.ceil(finalVal);
        const priceStr = new Intl.NumberFormat(currentCurrency === 'MXN' ? 'es-MX' : 'en-US', {
            style: 'currency', currency: currentCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0
        }).format(finalVal);
        
        text += `- ${i.qty}x ${i.name.substring(0, 30)}... (${priceStr})\n`;
    });
    
    text += `\n*Subtotal:* ${subtotalVal.innerText}`;
    text += `\n*IVA (16%):* ${taxVal.innerText}`;
    text += `\n*Total:* ${totalVal.innerText}`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
});

// Lógica de API GROQ
const GROQ_API_KEY = "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";

btnGenerateAI.addEventListener('click', async () => {
    const prompt = aiPromptInput.value.trim();
    if(!prompt) return alert("Por favor describe lo que necesitas.");
    
    btnGenerateAI.disabled = true;
    aiThinkingStatus.classList.remove('hidden');
    catalogList.classList.add('hidden');
    
    // Samplear catálogo
    const maxItems = 150; 
    const sample = catalogData.slice(0, maxItems).map(i => `ID:${i.id} | Name:${i.name} | Price:${i.price}`).join('\n');
    
    const sysPrompt = `Eres un cotizador experto. A partir del catálogo de productos que recibes, crea una lista de compra recomendada según lo pedido por el usuario.
Catálogo:
${sample}

Regla vital: Responde ESTRICTAMENTE en formato JSON plano con la siguiente estructura:
[
  {"id": "AQUÍ_ID_DEL_PRODUCTO", "qty": AQUÍ_CANTIDAD_NUMERICA}
]
Nada de explicaciones. Si no encuentras, devuelve [].`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: sysPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1
            })
        });
        
        const data = await response.json();
        const text = data.choices[0].message.content;
        
        const jsonMatch = text.match(/\[.*\]/s);
        let products = [];
        if (jsonMatch) {
            products = JSON.parse(jsonMatch[0]);
        } else {
            products = JSON.parse(text);
        }
        
        shoppingCart = [];
        products.forEach(p => {
             const item = catalogData.find(c => c.id === p.id);
             if (item) {
                 shoppingCart.push({ ...item, qty: p.qty || 1 });
             }
        });
        renderCart();
        
        if (shoppingCart.length > 0) {
            catalogList.innerHTML = '';
            const fragment = document.createDocumentFragment();
            shoppingCart.forEach(item => {
                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `
                    <span class="prod-code" style="color:#00ff88; margin-bottom: 5px; display:inline-block;"><i class="ph-fill ph-check-circle"></i> Result IA</span>
                    <div class="prod-name" style="margin-top:5px;">${item.name}</div>
                    <div class="prod-price">${formatCurrency(item.price)}</div>
                    <button class="add-btn" onclick="addToQuote('${item.id}')">
                        <i class="ph ph-plus-circle"></i> Añadir extra manual
                    </button>
                `;
                fragment.appendChild(card);
            });
            catalogList.appendChild(fragment);
            catalogList.classList.remove('hidden');
        } else {
            alert("La IA procesó la solicitud pero no pudo hallar productos que coincidan completamente.");
        }
        
    } catch (e) {
        console.error(e);
        alert("Ocurrió un error leyendo la IA. Revisa consola o intenta ser más directo indicando qué objetos en específico requieres.");
    } finally {
        btnGenerateAI.disabled = false;
        aiThinkingStatus.classList.add('hidden');
    }
});
