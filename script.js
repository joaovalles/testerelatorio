// Importações do Firebase SDK Modular
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

// Credenciais Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA20u249HTh7osBExNRznpd6UmQzqmTZRY",
    authDomain: "relatorio-30h.firebaseapp.com",
    projectId: "relatorio-30h",
    storageBucket: "relatorio-30h.firebasestorage.app",
    messagingSenderId: "315379117754",
    appId: "1:315379117754:web:e1847977fc374239575c83",
    measurementId: "G-G0PKYYG4JL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const reportsCollection = collection(db, 'relatorios');

let currentModule = 'module-logistica';

// ================= SISTEMA DE LOGIN E CONTA =================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('top-nav').classList.remove('hidden');
        switchGlobalModule('module-logistica');
    } else {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('top-nav').classList.add('hidden');
        document.getElementById('module-logistica').classList.add('hidden');
        document.getElementById('module-ra').classList.add('hidden');
    }
});

window.fazerLogin = async function() {
    const email = document.getElementById('emailInput').value;
    const pass = document.getElementById('passwordInput').value;
    const btn = document.getElementById('btnLogin');
    if(!email || !pass) return;
    btn.innerText = "Verificando...";
    document.getElementById('loginError').classList.add('hidden');
    try { await signInWithEmailAndPassword(auth, email, pass); } 
    catch (error) { document.getElementById('loginError').classList.remove('hidden'); } 
    finally { btn.innerText = "Entrar"; }
}

window.fazerLogout = function() {
    signOut(auth).then(() => {
        document.getElementById('emailInput').value = '';
        document.getElementById('passwordInput').value = '';
    });
}

window.alterarSenha = async function() {
    const newPass = document.getElementById('newPasswordInput').value;
    const confirmPass = document.getElementById('confirmPasswordInput').value;
    const msg = document.getElementById('passwordMsg');
    msg.classList.remove('hidden', 'text-red-600', 'text-green-600');
    if (!newPass || newPass.length < 6) {
        msg.innerText = "A senha deve ter pelo menos 6 caracteres.";
        msg.classList.add('text-red-600'); return;
    }
    if (newPass !== confirmPass) {
        msg.innerText = "As senhas não coincidem.";
        msg.classList.add('text-red-600'); return;
    }
    const user = auth.currentUser;
    if (user) {
        try {
            await updatePassword(user, newPass);
            msg.innerText = "Senha alterada com sucesso!";
            msg.classList.add('text-green-600');
            document.getElementById('newPasswordInput').value = '';
            document.getElementById('confirmPasswordInput').value = '';
        } catch (error) {
            msg.innerText = "Erro ao alterar. Saia e entre novamente na conta por segurança.";
            msg.classList.add('text-red-600');
        }
    }
}

// ================= CONTROLE NAVEGAÇÃO GLOBAL =================
window.switchGlobalModule = function(moduleId) {
    currentModule = moduleId;
    
    document.getElementById('module-logistica').classList.add('hidden');
    document.getElementById('module-ra').classList.add('hidden');
    
    const btnLog = document.getElementById('gnav-logistica');
    const btnRa = document.getElementById('gnav-ra');
    
    btnLog.className = "px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition";
    btnRa.className = "px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition";

    document.getElementById(moduleId).classList.remove('hidden');
    
    if(moduleId === 'module-logistica') {
        btnLog.className = "px-3 py-2 rounded-md text-sm font-medium bg-gray-800 text-white transition shadow";
    } else {
        btnRa.className = "px-3 py-2 rounded-md text-sm font-medium bg-gray-800 text-white transition shadow";
    }
}


// =============================================================
// ================= MÓDULO 1: LOGÍSTICA (30h+) ================
// =============================================================

const tableConfig = [
    { status: 'FATURADO (SC)', setor: 'ESTOQUE SC' },
    { status: 'EM SEPARAÇÃO (SC)', setor: 'ESTOQUE SC' },
    { status: 'AGUARDANDO COLETA (SC)', setor: 'ESTOQUE SC' },
    { status: 'VERIFICADO (SC)', setor: 'ESTOQUE SC' },
    { status: 'HD BRASIL ESTÁ MONTANDO SUA MÁQUINA (SC)', setor: 'ESTOQUE SC' },
    { status: 'PAGAMENTO APROVADO (SC)', setor: 'ESTOQUE SC' },
    { status: 'EM PROCESSAMENTO (SC)', setor: 'ESTOQUE SC' },
    { status: 'PENDENTE TROCA (SC)', setor: 'ESTOQUE SC' },
    { status: 'AGUARDANDO REVISÃO (SC)', setor: 'ATENDIMENTO' },
    { status: 'RETIDO (SC)', setor: 'ATENDIMENTO' },
    { status: 'AGUARDANDO DISPONIBILIDADE (SC)', setor: 'ATENDIMENTO' },
    { status: 'INCOMPATÍVEL (SC)', setor: 'ATENDIMENTO' },
    { status: 'PENDENTE REEMBOLSO (SC)', setor: 'ATENDIMENTO' }
];

let currentCounts = {};
let sectorOrders = {}; 
let chartInstanceSector = null;
let chartInstanceStatus = null;
let activeReportId = null; 
let historyCache = []; 
let currentTeamMessage = ""; 

function initCounts() {
    tableConfig.forEach(item => {
        currentCounts[item.status] = 0;
        sectorOrders[item.setor] = [];
    });
}
initCounts();

window.switchTab = function(tabId) {
    document.getElementById('tab-analise').classList.add('hidden');
    document.getElementById('tab-historico').classList.add('hidden');
    document.getElementById('tab-conta').classList.add('hidden');
    document.getElementById(tabId).classList.remove('hidden');

    document.getElementById('nav-analise').classList.remove('active');
    document.getElementById('nav-historico').classList.remove('active');
    document.getElementById('nav-conta').classList.remove('active');
    
    if(tabId === 'tab-analise') document.getElementById('nav-analise').classList.add('active');
    if(tabId === 'tab-historico') {
        document.getElementById('nav-historico').classList.add('active');
        fetchHistoryFromFirebase();
    }
    if(tabId === 'tab-conta') document.getElementById('nav-conta').classList.add('active');
}

window.handleFileUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheetName = workbook.SheetNames[0];
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: false, dateNF: 'dd/mm/yyyy' });
        processNewData(jsonData);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
}

function processNewData(data) {
    initCounts();
    activeReportId = null; 

    data.forEach(row => {
        const rowNormalized = {};
        for(let key in row) { rowNormalized[key.trim().toLowerCase()] = row[key]; }
        
        const idPedido = rowNormalized['idvenda'] || rowNormalized['pedido'] || '';
        const statusStr = (rowNormalized['status'] || '').toString().trim().toUpperCase();
        const dataStr = rowNormalized['datahora'] || rowNormalized['data'] || rowNormalized['data do pedido'] || rowNormalized['criado em'] || '-';
        
        if(!idPedido && statusStr === '') return;

        for (let config of tableConfig) {
            if (statusStr.includes(config.status) || config.status.includes(statusStr)) {
                currentCounts[config.status]++;
                sectorOrders[config.setor].push({ data: dataStr, pedido: idPedido, status: statusStr });
                break;
            }
        }
    });

    document.getElementById('currentReportLabel').innerText = "Relatório em exibição: Nova análise (Não salva na nuvem)";
    document.getElementById('btnSave').classList.remove('hidden');
    updateDashboard();
    window.switchTab('tab-analise');
}

function updateDashboard() {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('uiArea').classList.remove('hidden');
    document.getElementById('uiArea').classList.add('flex');
    renderTable();
    generateTextForTeam(); 
    renderCharts();
    renderSectorDetails(); 
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    tableConfig.forEach(config => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${config.status}</td><td>${config.setor}</td><td class="font-bold text-lg">${currentCounts[config.status]}</td>`;
        tbody.appendChild(tr);
    });
}

function generateTextForTeam() {
    const now = new Date();
    const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    let texto = `Bom dia meus consagrados!\n\nSegue relação de 30+ para avaliação, retirado as ${hora}, podem ter ocorrido atualizações!\n\nEstoque SC @Mario Tobal Se precisar de uma mão só avisar!\n\n`;
    tableConfig.forEach(config => { if (config.setor === 'ESTOQUE SC' && currentCounts[config.status] > 0) texto += `${config.status}    ${currentCounts[config.status]}\n`; });
    texto += `\nATENDIMENTO - Já em validação, quebras bem controladas, e validando casos de pendente reembolso e retido para a finalização.\n\n`;
    tableConfig.forEach(config => { if (config.setor === 'ATENDIMENTO' && currentCounts[config.status] > 0) texto += `${config.status}    ${currentCounts[config.status]}\n`; });
    texto += `\nSegue planilha para acompanhamento:\nRELATÓRIO 30+`;
    currentTeamMessage = texto;
}

window.copyText = function() {
    navigator.clipboard.writeText(currentTeamMessage).then(() => {
        const msg = document.getElementById('copyMsg');
        if(msg) { msg.classList.remove('hidden'); setTimeout(() => msg.classList.add('hidden'), 3000); }
    });
}

function renderCharts() {
    if (chartInstanceSector) chartInstanceSector.destroy();
    if (chartInstanceStatus) chartInstanceStatus.destroy();

    let scTotal = 0, atTotal = 0;
    tableConfig.forEach(c => {
        if(c.setor === 'ESTOQUE SC') scTotal += currentCounts[c.status];
        if(c.setor === 'ATENDIMENTO') atTotal += currentCounts[c.status];
    });

    const ctxSector = document.getElementById('sectorChart').getContext('2d');
    chartInstanceSector = new Chart(ctxSector, { type: 'doughnut', data: { labels: ['Estoque SC', 'Atendimento'], datasets: [{ data: [scTotal, atTotal], backgroundColor: ['#2563eb', '#16a34a'], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false } });

    const statusLabels = [], statusData = [];
    tableConfig.forEach(c => {
        if (currentCounts[c.status] > 0) { statusLabels.push(c.status.replace(' (SC)', '')); statusData.push(currentCounts[c.status]); }
    });

    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    chartInstanceStatus = new Chart(ctxStatus, { type: 'bar', data: { labels: statusLabels, datasets: [{ label: 'Qtd de Pedidos', data: statusData, backgroundColor: '#f59e0b', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } });
}

function renderSectorDetails() {
    const container = document.getElementById('sectorDetailsContainer');
    container.innerHTML = ''; 
    const distinctSectors = [...new Set(tableConfig.map(c => c.setor))];
    distinctSectors.forEach(setor => {
        const orders = sectorOrders[setor] || [];
        if (orders.length === 0) return; 
        const section = document.createElement('div');
        section.className = 'bg-white p-6 rounded-lg shadow-md border border-gray-300 flex flex-col mt-4';
        let rowsHtml = '';
        orders.forEach(o => { rowsHtml += `<tr class="border-b hover:bg-gray-50"><td class="p-3 border text-gray-700">${o.data}</td><td class="p-3 border font-mono text-blue-800 font-bold">${o.pedido}</td><td class="p-3 border text-gray-700 text-xs">${o.status}</td></tr>`; });
        section.innerHTML = `<div class="flex flex-col sm:flex-row justify-between items-center mb-4 border-b pb-3 gap-3"><h3 class="text-xl font-bold text-gray-800">Detalhamento: ${setor}</h3><button onclick="copySectorData('${setor}')" class="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-bold shadow transition flex items-center gap-2">📋 Copiar Dados para Planilha (${orders.length})</button></div><div class="overflow-x-auto max-h-96 overflow-y-auto"><table class="w-full border-collapse text-sm"><thead class="sticky top-0 bg-gray-200 shadow-sm z-10"><tr class="text-gray-700"><th class="p-3 border text-left font-bold">Data</th><th class="p-3 border text-left font-bold">Pedido</th><th class="p-3 border text-left font-bold">Status Exato</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
        container.appendChild(section);
    });
}

window.copySectorData = function(setor) {
    const orders = sectorOrders[setor] || [];
    if(orders.length === 0) return;
    let tsvData = "Data\tPedido\tStatus\n";
    orders.forEach(o => { tsvData += `${o.data}\t${o.pedido}\t${o.status}\n`; });
    navigator.clipboard.writeText(tsvData).then(() => { alert(`Dados dos pedidos de ${setor} copiados!`); });
}

window.saveCurrentReport = async function() {
    let total = 0; tableConfig.forEach(c => total += currentCounts[c.status]);
    const reportData = { timestamp: new Date().getTime(), dateLabel: new Date().toLocaleString('pt-BR'), total: total, createdBy: auth.currentUser ? auth.currentUser.email : "Desconhecido", counts: { ...currentCounts }, orders: sectorOrders };
    const btn = document.getElementById('btnSave'); btn.innerText = "Salvando..."; btn.disabled = true;
    try {
        const docRef = await addDoc(reportsCollection, reportData);
        alert("Salvo com sucesso!");
        btn.classList.add('hidden'); document.getElementById('currentReportLabel').innerText = `Salvo em ${reportData.dateLabel}`; activeReportId = docRef.id;
    } catch (e) { alert("Erro ao salvar."); } finally { btn.innerText = "💾 Salvar no Firebase"; btn.disabled = false; }
}

async function fetchHistoryFromFirebase() {
    try {
        const q = query(reportsCollection, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        historyCache = [];
        querySnapshot.forEach((doc) => { historyCache.push({ id: doc.id, ...doc.data() }); });
        renderHistoryTable();
    } catch (e) { document.getElementById('historyTableBody').innerHTML = '<tr><td colspan="4">Erro na busca.</td></tr>'; }
}

function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    if(historyCache.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="text-center">Vazio.</td></tr>`; return; }
    historyCache.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="p-3">${item.dateLabel}</td><td class="p-3 text-center">${item.total}</td><td class="p-3">${item.createdBy || 'Sistema'}</td><td class="p-3 text-center"><button onclick="loadReport('${item.id}')" class="bg-blue-600 text-white px-3 py-1 rounded">Visualizar</button> <button onclick="deleteReport('${item.id}')" class="bg-red-500 text-white px-3 py-1 rounded">Excluir</button></td>`;
        tbody.appendChild(tr);
    });
}

window.loadReport = function(id) {
    const report = historyCache.find(r => r.id === id);
    if(report) {
        currentCounts = { ...report.counts };
        sectorOrders = report.orders ? report.orders : (initCounts(), { ...report.counts }); 
        activeReportId = report.id;
        document.getElementById('currentReportLabel').innerText = `Histórico: ${report.dateLabel}`;
        document.getElementById('btnSave').classList.add('hidden'); 
        updateDashboard(); window.switchTab('tab-analise');
    }
}

window.deleteReport = async function(id) {
    if(confirm(`Tem certeza que deseja excluir?`)) {
        try {
            await deleteDoc(doc(db, "relatorios", id));
            historyCache = historyCache.filter(r => r.id !== id);
            if(activeReportId === id) { document.getElementById('uiArea').classList.add('hidden'); document.getElementById('emptyState').classList.remove('hidden'); activeReportId = null; }
            renderHistoryTable();
        } catch(e) { alert("Erro ao excluir."); }
    }
}

function generateAnalysis() {
    let total = 0, scTotal = 0, atTotal = 0;
    tableConfig.forEach(c => {
        total += currentCounts[c.status];
        if (c.setor === 'ESTOQUE SC') scTotal += currentCounts[c.status];
        if (c.setor === 'ATENDIMENTO') atTotal += currentCounts[c.status];
    });
    const analysisContainer = document.getElementById('executiveAnalysis');
    if (total === 0) { analysisContainer.innerHTML = `<p>Sem atrasos.</p>`; return; }
    analysisContainer.innerHTML = `<p>O cenário atual reporta um acumulado de <strong>${total} pedidos</strong> com tempo de permanência superior a 30 horas.</p>`;
}

window.generatePDF = function() {
    window.scrollTo(0, 0); generateAnalysis();
    const pdfTable = document.getElementById('pdfTable');
    let tableHTML = `<thead><tr><th>Status</th><th>Setor Responsável</th><th>QTD</th></tr></thead><tbody>`;
    tableConfig.forEach(config => { tableHTML += `<tr><td>${config.status}</td><td>${config.setor}</td><td style="font-weight: bold;">${currentCounts[config.status]}</td></tr>`; });
    tableHTML += `</tbody>`; pdfTable.innerHTML = tableHTML;
    document.getElementById('pdfDate').innerText = `Documento referente a: ${new Date().toLocaleString()}`;
    document.body.classList.add('is-printing');
    html2pdf().set({ margin: 15, filename: `Analise.pdf`, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(document.getElementById('pdfContent')).save().then(() => { document.body.classList.remove('is-printing'); });
}

// =============================================================
// ================= MÓDULO 2: RECLAME AQUI ====================
// =============================================================

let raDataAll = []; 
let raChartInstance = null;

function parseRADateObj(dateStr) {
    if(!dateStr || dateStr === '-' || dateStr === '' || dateStr.toString().toUpperCase() === 'NÃO INFORMADO') return null;
    try {
        const datePart = dateStr.toString().split(' ')[0];
        const parts = datePart.split(/[\/\-]/); 
        
        let dateObj;
        if(parts[0].length === 4) { 
            dateObj = new Date(parts[0], parseInt(parts[1])-1, parts[2]); 
        } else if (parts.length === 3) { 
            dateObj = new Date(parts[2], parseInt(parts[1])-1, parts[0]); 
        } else {
            return null;
        }
        
        if(isNaN(dateObj.getTime())) return null;
        return dateObj;
    } catch(e) {
        return null;
    }
}

function findKeyByKeywords(obj, keywords) {
    const keys = Object.keys(obj);
    for (let k of keys) {
        if (keywords.includes(k)) return k;
    }
    for (let k of keys) {
        for (let kw of keywords) {
            if (k.includes(kw)) return k;
        }
    }
    return null;
}

window.handleRAFileUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheetName = workbook.SheetNames[0];
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: false, dateNF: 'dd/mm/yyyy' });
        processRAData(jsonData);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
}

function processRAData(data) {
    raDataAll = [];

    data.forEach(row => {
        const rowNorm = {};
        for(let key in row) { rowNorm[key.trim().toLowerCase()] = row[key]; }

        const kAbertura = findKeyByKeywords(rowNorm, ['entrada', 'data de abertura', 'criado']);
        const kRespondido = findKeyByKeywords(rowNorm, ['data da resposta', 'respondida em']);
        const kTicket = findKeyByKeywords(rowNorm, ['ticket']);
        const kID = findKeyByKeywords(rowNorm, ['id']);
        const kPedido = findKeyByKeywords(rowNorm, ['pedido', 'número do pedido']);
        const kCliente = findKeyByKeywords(rowNorm, ['cliente', 'nome do consumidor']);
        const kStatus = findKeyByKeywords(rowNorm, ['situação', 'status']);
        const kNota = findKeyByKeywords(rowNorm, ['nota', 'avaliação']);
        const kCategoria = findKeyByKeywords(rowNorm, ['categoria', 'motivo', 'assunto']);

        const idVal = kID ? rowNorm[kID].toString().trim() : '';
        const ticketVal = kTicket ? rowNorm[kTicket].toString().trim() : '';
        
        let idTicketFinal = '-';
        if (idVal && idVal !== '-' && idVal.toUpperCase() !== 'NÃO INFORMADO') idTicketFinal = idVal;
        
        if (ticketVal && ticketVal !== '-' && ticketVal.toUpperCase() !== 'NÃO INFORMADO') {
            idTicketFinal = idTicketFinal !== '-' ? `${idTicketFinal} / ${ticketVal}` : ticketVal;
        }
        
        if (idTicketFinal === '-') idTicketFinal = 'NÃO INFORMADO';

        let notaVal = kNota ? rowNorm[kNota].toString().trim().toUpperCase() : '';
        if (notaVal === 'NÃO INFORMADO' || notaVal === 'NAN' || notaVal === '-' || notaVal === '') {
            notaVal = '';
        }

        const aberturaStr = kAbertura ? rowNorm[kAbertura].toString().trim() : '-';

        const record = {
            abertura: aberturaStr,
            dataAberturaObj: parseRADateObj(aberturaStr), 
            respondido: kRespondido ? rowNorm[kRespondido].toString().trim() : '-',
            ticketId: idTicketFinal,
            pedido: kPedido ? rowNorm[kPedido].toString().trim() : '-',
            cliente: kCliente ? rowNorm[kCliente].toString().trim() : '-',
            status: kStatus ? rowNorm[kStatus].toString().trim() : 'Sem Status',
            nota: notaVal,
            categoria: kCategoria ? rowNorm[kCategoria].toString().trim() : 'Não categorizado'
        };

        raDataAll.push(record);
    });

    let validDates = raDataAll.map(r => r.dataAberturaObj).filter(d => d !== null);
    if (validDates.length > 0) {
        let minDate = new Date(Math.min(...validDates));
        let maxDate = new Date(Math.max(...validDates));
        
        document.getElementById('raStartDate').value = minDate.toISOString().split('T')[0];
        document.getElementById('raEndDate').value = maxDate.toISOString().split('T')[0];
    }
    
    document.getElementById('emptyStateRA').classList.add('hidden');
    document.getElementById('uiAreaRA').classList.remove('hidden');
    document.getElementById('uiAreaRA').classList.add('flex');

    window.filterRADashboard(); 
}

window.filterRADashboard = function() {
    const startVal = document.getElementById('raStartDate').value;
    const endVal = document.getElementById('raEndDate').value;

    let filteredData = raDataAll;

    if (startVal) {
        const startDate = new Date(startVal + 'T00:00:00');
        filteredData = filteredData.filter(r => r.dataAberturaObj && r.dataAberturaObj >= startDate);
    }
    
    if (endVal) {
        const endDate = new Date(endVal + 'T23:59:59');
        filteredData = filteredData.filter(r => r.dataAberturaObj && r.dataAberturaObj <= endDate);
    }

    renderRADashboard(filteredData);
}

function renderRADashboard(periodData) {
    // 1. Processamento Geral (KPIs e Gráficos que NÃO são afetados pelo filtro da tabela)
    let cAbertas = periodData.length;
    let cRespondidas = 0;
    let cAvaliadas = 0;
    let cResolvidas = 0;
    let cExcluidas = 0;
    
    let categoriasNotaZero = {};
    let criticalItems = []; 

    periodData.forEach(item => {
        const st = item.status.toLowerCase();
        
        if(st.includes('respondid')) cRespondidas++;
        if(item.nota !== '') cAvaliadas++;
        if(st.includes('resolvid')) cResolvidas++;
        if(st.includes('excluíd') || st.includes('desativada')) cExcluidas++;

        if(item.nota === '0' || st.includes('não resolvid')) {
            const cat = item.categoria;
            categoriasNotaZero[cat] = (categoriasNotaZero[cat] || 0) + 1;
            criticalItems.push(item);
        }
    });

    document.getElementById('raKpiAbertas').innerText = cAbertas;
    document.getElementById('raKpiRespondidas').innerText = cRespondidas;
    document.getElementById('raKpiAvaliadas').innerText = cAvaliadas;
    document.getElementById('raKpiResolvidas').innerText = cResolvidas;
    document.getElementById('raKpiExcluidas').innerText = cExcluidas;

    if(raChartInstance) raChartInstance.destroy();
    
    const catLabels = Object.keys(categoriasNotaZero);
    const catData = Object.values(categoriasNotaZero);
    
    const ctx = document.getElementById('raCategoryChart').getContext('2d');
    raChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: catLabels.length > 0 ? catLabels : ['Sem notas 0 no período'],
            datasets: [{
                label: 'Qtd Detratores',
                data: catData.length > 0 ? catData : [0],
                backgroundColor: '#ef4444', 
                borderRadius: 4
            }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    const divCritical = document.getElementById('raCriticalList');
    let criticalHtml = '';
    
    if(criticalItems.length === 0) {
        criticalHtml = `<p class="text-green-600 font-bold text-center mt-4">Nenhuma avaliação crítica encontrada no período! 🎉</p>`;
    } else {
        criticalItems.forEach(c => {
            criticalHtml += `
                <div class="bg-white p-3 mb-2 rounded border border-red-100 shadow-sm">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-800 text-xs">ID/Tk: ${c.ticketId}</span>
                        <span class="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded">Nota: ${c.nota || 'S/N'}</span>
                    </div>
                    <p class="text-xs text-gray-600 truncate">${c.cliente}</p>
                    <p class="text-xs text-gray-500 font-bold mt-1">Motivo: ${c.categoria}</p>
                </div>
            `;
        });
    }
    divCritical.innerHTML = criticalHtml;

    // 2. Processamento Exclusivo da Tabela com base no "Select"
    const tableFilterElement = document.getElementById('raTableFilter');
    const tableFilter = tableFilterElement ? tableFilterElement.value : 'all';

    let tableData = periodData;

    // Aplicando os filtros específicos para a tabela
    if (tableFilter === 'avaliadas') {
        tableData = periodData.filter(row => row.nota !== '');
    } else if (tableFilter === 'respondidas') {
        tableData = periodData.filter(row => row.status.toLowerCase().includes('respondid'));
    } else if (tableFilter === 'excluidas') {
        tableData = periodData.filter(row => row.status.toLowerCase().includes('excluíd') || row.status.toLowerCase().includes('desativada'));
    }

    const tbody = document.getElementById('raTableBody');
    let tbodyHtml = ''; 

    // Renderiza a tabela usando APENAS os dados passados pelo filtro acima
    tableData.forEach(row => {
        let notaBadge = `<span class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-bold">N/I</span>`;
        if(row.nota !== '') {
            let color = 'bg-yellow-200 text-yellow-800'; 
            if(parseInt(row.nota) >= 7) color = 'bg-green-200 text-green-800'; 
            if(parseInt(row.nota) <= 3) color = 'bg-red-200 text-red-800'; 
            notaBadge = `<span class="${color} px-2 py-1 rounded text-xs font-bold">${row.nota}</span>`;
        }

        let dateAberturaExibicao = row.abertura !== '-' ? row.abertura.toString().split(' ')[0] : '-';
        let dateRespostaExibicao = row.respondido !== '-' ? row.respondido.toString().split(' ')[0] : '-';

        tbodyHtml += `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-2 border whitespace-nowrap text-xs">${dateAberturaExibicao}</td>
                <td class="p-2 border whitespace-nowrap text-xs text-blue-700 font-semibold">${dateRespostaExibicao}</td>
                <td class="p-2 border font-mono font-bold text-purple-700">${row.ticketId}</td>
                <td class="p-2 border text-gray-600 text-xs">${row.pedido}</td>
                <td class="p-2 border text-gray-800 max-w-[150px] truncate" title="${row.cliente}">${row.cliente}</td>
                <td class="p-2 border text-xs font-semibold text-gray-600 uppercase">${row.status}</td>
                <td class="p-2 border text-center">${notaBadge}</td>
                <td class="p-2 border text-xs text-gray-600">${row.categoria}</td>
            </tr>
        `;
    });
    
    // Mostra um aviso na tabela caso o filtro retorne vazio
    if (tableData.length === 0) {
        tbodyHtml = `<tr><td colspan="8" class="p-6 text-center text-gray-500 font-bold">Nenhum registro encontrado para este filtro no período.</td></tr>`;
    }

    tbody.innerHTML = tbodyHtml; 
}