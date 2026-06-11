import BaseController from "./BaseController";
import Spreadsheet from "sap/ui/export/Spreadsheet";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import Sorter from "sap/ui/model/Sorter";
import formatter from "../model/formatter";
import UI5Event from "sap/ui/base/Event";
import Table from "sap/m/Table";
import DateRangeSelection from "sap/m/DateRangeSelection";
import SearchField from "sap/m/SearchField";

/**
 * Controller per la Home.
 * Gestisce la lista ordini, i totali dinamici, l'export Excel e la ricerca filtrata.
 * @namespace orders.controller
 */
export default class Home extends BaseController {

    // Collega il file dei formatter alla vista, essenziale per i colori degli stati e la valuta
    public formatter = formatter;
    private _bSortDescending: boolean = false; // Variabile interna per tracciare lo stato dell'ordinamento (true = discendente, false = ascendente)

    public onInit(): void {
        // Crea un modello JSON locale esclusivamente per gestire i conteggi a fondo pagina.
        // Questo modello vive solo nel client e non dipende direttamente dal server SAP.
        const oSummaryModel = new JSONModel({
            TotalCount: 0,   // Inizializza il contatore del numero di ordini a zero
            TotalValue: 0.00 // Inizializza la somma in euro a zero
        });
        
        // Assegna il modello alla vista nominandolo "summaryModel", 
        // così la vista XML sa esattamente dove andare a leggere questi numeri tramite il binding {summaryModel>/TotalCount}
        this.setModel(oSummaryModel, "summaryModel");
    }

    // ========================================================================
    // NAVIGAZIONE
    // ========================================================================
    
    public onNavToCreateOrder(): void {
        // Naviga alla rotta del dettaglio ordine, ma passa la stringa speciale "new".
        // Il controller del dettaglio (OrderForm) intercetta questo ID e capisce che deve 
        // inizializzare il form in modalità "creazione" invece di caricare un ordine esistente.
        this.getRouter().navTo("RouteOrderForm", {
            objectId: "new"
        });
    }

    public onNavToDetail(oEvent: UI5Event): void {
        // Ottiene l'elemento fisico della tabella su cui l'utente ha cliccato (la riga)
        const oItem = oEvent.getSource() as any;
        
        // Ottiene il contesto dei dati (la porzione di database associata a quella specifica riga)
        const oBindingContext = oItem.getBindingContext(); 
        
        if (oBindingContext) {
            // Estrae dal contesto il numero esatto dell'ordine cliccato, 
            // che servirà come chiave per caricare i dettagli nel form.
            const sOrderNum = oBindingContext.getProperty("NumOrdine");

            // Naviga alla rotta del dettaglio passando l'ID dell'ordine reale.
            this.getRouter().navTo("RouteOrderForm", {
                objectId: sOrderNum
            });
        }
    }

    // ========================================================================
    // TOTALI DINAMICI
    // ========================================================================
    
    public onTableUpdateFinished(): void {
        // Questo evento scatta in automatico ogni volta che la tabella finisce di 
        // disegnare i dati (al caricamento, dopo un filtro, o dopo un ordinamento).
        // Deleghiamo il calcolo a una funzione separata per mantenere il codice pulito.
        this._calculateTotal();
    }

    private _calculateTotal(): void {
        // Recupera l'istanza della tabella tramite il suo ID dichiarato nell'XML.
        // Usiamo "as Table" per dire a TypeScript: "Questo oggetto è sicuramente una Tabella sap.m.Table".
        const oTable = this.byId("ordersTable") as Table;
        
        // PREVENZIONE BUG BACKEND: 
        // Usiamo getItems() per prendere solo le righe che l'utente vede fisicamente a schermo,
        // ignorando il modello in memoria (evitiamo così di sommare righe che non dovrebbero essere lì).
        const aItems = oTable.getItems(); 

        let iTotalCount = 0; // Variabile d'appoggio per contare le righe valide  
        let fTotalValue = 0; // Variabile d'appoggio per sommare gli euro  

        // Analizziamo una ad una le righe visibili
        aItems.forEach((oItem) => {
            const oContext = oItem.getBindingContext();
            
            // Se la riga ha dei dati validi ad essa associati
            if (oContext) {
                // Leggiamo lo stato e l'importo di quella riga specifica
                const sStatus = oContext.getProperty("StatoTxt");
                const sAmount = oContext.getProperty("ImportoTot");

                // Contiamo la riga e sommiamo i soldi SOLO se l'ordine non è stato cancellato.
                if (sStatus !== "Cancellato") {
                    iTotalCount++; 
                    // parseFloat trasforma la stringa in un numero decimale (default 0 se non esiste)
                    fTotalValue += parseFloat(sAmount || "0"); 
                }
            }
        });

        // Peschiamo il modello dei totali che avevamo creato in onInit
        const oSummaryModel = this.getModel("summaryModel") as JSONModel;
        
        if (oSummaryModel) {
            // Scriviamo i nuovi calcoli nel modello. La vista XML si aggiornerà all'istante da sola.
            oSummaryModel.setProperty("/TotalCount", iTotalCount);
            oSummaryModel.setProperty("/TotalValue", fTotalValue.toFixed(2));
        }
    }

    // ========================================================================
    // EXPORT EXCEL: Trasforma la visualizzazione della tabella in un file .xlsx
    // ========================================================================
    public async onExport(): Promise<void> {
        // Recuperiamo il file i18n per assicurarci che le etichette delle colonne
        // nel file Excel siano tradotte nella lingua dell'utente.
        const oBundle = this.getResourceBundle();
        
        // Definiamo la struttura del file Excel: ogni oggetto associa l'etichetta visualizzata
        // all'utente (label) con il campo tecnico presente nel database (property).
        const aCols = [
            { label: oBundle.getText("colOrderID"), property: "NumOrdine", type: "number" },
            { label: oBundle.getText("colCustomer"), property: "Cliente", type: "string" },
            { label: oBundle.getText("colOrderDate"), property: "DataOrdine", type: "date", format: "dd/MM/yyyy" },
            { label: oBundle.getText("colTotalAmount"), property: "ImportoFormattato", type: "string" },
            { label: oBundle.getText("colStatus"), property: "StatoTxt", type: "string" }
        ];

        // Recuperiamo l'istanza della tabella per accedere ai dati caricati (il binding).
        const oTable = this.byId("ordersTable") as Table;
        // Estrarre i contesti significa prendere gli oggetti grezzi dal modello OData.
        const aContexts = oTable.getBinding("items")?.getContexts() || [];
        
        // Trasformiamo i dati OData complessi in un array di oggetti piatti,
        // pronti per essere scritti nelle righe del foglio Excel.
        const aData = aContexts.map((oContext) => {
            const oRow = oContext.getObject();
            // Creiamo un clone dell'oggetto riga per non sporcare il modello originale.
            const oExportRow = Object.assign({}, oRow);
            // Applichiamo il formatter locale per ottenere una stringa formattata "123,45 €"
            // che è più leggibile nel file Excel rispetto al numero grezzo.
            oExportRow.ImportoFormattato = formatter.currencyValue(oRow.ImportoTot);
            return oExportRow;
        });

        // Configurazione finale del componente Spreadsheet
        const oSettings = {
            workbook: { columns: aCols }, // La struttura delle intestazioni
            dataSource: aData,           // Il contenuto del file
            fileName: "Orders_Export.xlsx" // Nome del file salvato
        };

        // Generiamo il file: Spreadsheet.build() ritorna una Promise.
        const oSheet = new Spreadsheet(oSettings);
        try {
            // await attende che il browser finisca di creare e scaricare il file.
            await oSheet.build();
        } finally {
            // Importante: distruggiamo l'oggetto oSheet appena finito per liberare 
            // immediatamente la memoria RAM del browser.
            oSheet.destroy(); 
        }
    }

    // ========================================================================
    // RICERCA FILTRATA ODATA: Applica filtri multipli al binding della tabella
    // ========================================================================
    public onSearch(): void {
        const aFilters: Filter[] = [];

        // Recuperiamo i dati inseriti nei vari campi di input (Testo, Stato, DateRange)
        const oSearchField = this.byId("searchField") as SearchField;
        const sSearchQuery = oSearchField ? oSearchField.getValue() : "";
        
        // Cast a 'any' necessario perché getSelectedKey() non è standard su tutti i controlli
        const sStatusKey = (this.byId("statusFilter") as any).getSelectedKey();
        
        const oDateRange = this.byId("dateFilter") as DateRangeSelection;
        const oDateFrom = oDateRange ? oDateRange.getDateValue() : null;
        const oDateTo = oDateRange ? oDateRange.getSecondDateValue() : null;

        // Se l'utente ha scritto qualcosa, aggiungiamo il filtro per Cliente
        if (sSearchQuery) {
            aFilters.push(new Filter("Cliente", FilterOperator.Contains, sSearchQuery));
        }

        // Se è stato selezionato uno stato, aggiungiamo il filtro esatto (EQ)
        if (sStatusKey) {
            aFilters.push(new Filter("Stato", FilterOperator.EQ, parseInt(sStatusKey, 10)));
        }

        // Se c'è un intervallo di date, usiamo l'operatore Between (BT)
        if (oDateFrom) {
            aFilters.push(new Filter("DataOrdine", FilterOperator.BT, oDateFrom, oDateTo || oDateFrom));
        }

        // Applichiamo l'array di filtri accumulati. UI5 invierà questi dati al server OData
        // sotto forma di stringa "$filter=..."
        (this.byId("ordersTable") as Table).getBinding("items")?.filter(aFilters);
    }

    // ========================================================================
    // SOFT DELETE: Archiviazione logica tramite Deep Insert (Update)
    // ========================================================================
    public onDeleteOrder(oEvent: UI5Event): void {
        const oContext = oEvent.getSource().getBindingContext() as any;
        const oRowData = oContext.getObject(); 

        // Chiediamo conferma visiva prima di modificare dati permanentemente
        MessageBox.confirm(this.getText("msgDeleteConfirm"), {
            onClose: async (sAction: string) => {
                if (sAction === MessageBox.Action.YES) {
                    // Feedback visivo di caricamento mentre il server processa
                    sap.ui.core.BusyIndicator.show(0); 
                    
                    // Prepariamo il payload della Deep Insert richiesto dall'architettura del backend.
                    const oUpdatePayload = {
                        "Operation": "U", 
                        "NumOrdine": parseInt(oRowData.NumOrdine, 10), 
                        "ZET_lista_ordini": {
                            "NumOrdine": parseInt(oRowData.NumOrdine, 10),
                            "Cliente": oRowData.Cliente,
                            "DataOrdine": oRowData.DataOrdine, 
                            "ImportoTot": parseFloat(oRowData.ImportoTot),
                            "Stato": 4 
                        },
                        "ZET_dettagli_ordiniSet": [] 
                    };

                    try {
                        // Inviamo l'aggiornamento asincrono
                        await this.odataCreate("/ZES_DeepOrdiniSet", oUpdatePayload);
                        MessageToast.show("Ordine archiviato con successo"); 
                        
                        // AGGIORNAMENTO LOCALE (Workaround): 
                        // Poiché non c'è COMMIT, aggiorniamo manualmente il modello in RAM
                        const sPath = oContext.getPath();
                        this.getModel().setProperty(sPath + "/StatoTxt", "Cancellato");
                        this.getModel().setProperty(sPath + "/Stato", 4);
                        
                        // Ricalcoliamo i totali per escludere l'ordine appena archiviato
                        this._calculateTotal();
                    } catch (oError) {
                        // Se qualcosa fallisce, mostriamo l'errore tecnico ricevuto dal server
                        this.handleBackendError(oError); 
                    } finally {
                        // Indipendentemente dall'esito, chiudiamo l'icona di caricamento
                        sap.ui.core.BusyIndicator.hide();
                    }
                }
            }
        });
    }

    // ========================================================================
    // GESTIONE ORDINAMENTO: Alterna ordinamento crescente/decrescente
    // ========================================================================
    public onSort(): void {
        const oTable = this.byId("ordersTable") as Table;
        const oBinding = oTable.getBinding("items") as any;

        // Invertiamo il valore booleano della variabile di stato interna
        this._bSortDescending = !this._bSortDescending;

        // Creiamo l'ordinatore e lo applichiamo al binding
        oBinding.sort(new Sorter("DataOrdine", this._bSortDescending));

        // Feedback utente per confermare l'avvenuto riordinamento
        MessageToast.show(this._bSortDescending ? "Ordinato: Più recenti" : "Ordinato: Meno recenti");
    }
}