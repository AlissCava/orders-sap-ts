import BaseController from "./BaseController";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Spreadsheet from "sap/ui/export/Spreadsheet";
import UI5Event from "sap/ui/base/Event";
import Table from "sap/m/Table";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import SearchField from "sap/m/SearchField";

/**
 * Controller per la gestione degli Articoli.
 * @namespace orders.controller
 */
export default class Articles extends BaseController {

    public onInit(): void {
        // In questo caso l'onInit è vuoto perché il caricamento dati è gestito dal binding nell'XML
    }

    // ========================================================================
    // NAVIGAZIONE
    // ========================================================================
    
    public onCreateArticle(): void {
        // Naviga alla rotta del form passando "new" come ID per indicare un nuovo inserimento
        this.getRouter().navTo("RouteArticleForm", {
            objectId: "new"
        });
    }

    public onArticlePress(oEvent: UI5Event): void {
        // Ottiene l'oggetto (la riga) che ha scatenato l'evento
        const oItem = oEvent.getSource() as any;
        // Recupera dal contesto del binding il valore della proprietà "CodArticolo"
        const sArticleCode = oItem.getBindingContext().getProperty("CodArticolo");
        // Naviga al form passando il codice dell'articolo selezionato per la modifica
        this.getRouter().navTo("RouteArticleForm", {
            objectId: sArticleCode
        });
    }

    // ========================================================================
    // ELIMINAZIONE
    // ========================================================================
    
    public onDeleteArticle(oEvent: UI5Event): void {
        let oContext: any;
        
        // Verifica la provenienza dell'evento (pressione riga o pulsante specifico)
        const oListItem = oEvent.getParameter("listItem");
        if (oListItem) {
            oContext = oListItem.getBindingContext();
        } else {
            oContext = oEvent.getSource().getBindingContext();
        }
        
        const sPath = oContext.getPath(); 

        // Mostra un popup di conferma prima di procedere
        MessageBox.confirm(this.getText("msgDeleteConfirm"), {
            title: this.getText("appTitle"),
            actions: [MessageBox.Action.YES, MessageBox.Action.NO],
            onClose: async (sAction: string) => {
                // Se l'utente conferma cliccando su "YES"
                if (sAction === MessageBox.Action.YES) {
                    sap.ui.core.BusyIndicator.show(0); 
                    try {
                        // Chiama il metodo DELETE asincrono dal BaseController
                        await this.odataDelete(sPath);
                        MessageToast.show(this.getText("msgArticleDeleted"));
                    } catch (oError) {
                        // In caso di errore (es: vincoli a DB), lo gestisce in modo centralizzato
                        this.handleBackendError(oError); 
                    } finally {
                        sap.ui.core.BusyIndicator.hide();
                    }
                }
            }
        });
    }

    // ========================================================================
    // EXPORT EXCEL
    // ========================================================================
    
    public onExportExcel(): void {
        // Recupera l'istanza della tabella tramite il suo ID
        const oTable = this.byId("articlesTable") as Table; 
        // Ottiene il binding degli elementi
        const oRowBinding = oTable.getBinding("items") as any; 
        const oBundle = this.getResourceBundle();

        // Definisce la struttura delle colonne del file Excel
        const aCols = [
            { label: oBundle.getText("colArticleCode"), property: "CodArticolo", type: "string" },
            { label: oBundle.getText("colArticleName"), property: "NomeArticolo", type: "string" },
            { label: oBundle.getText("colPrice"), property: "Importo", type: "number", scale: 2 },
            { label: oBundle.getText("colAvailableQty"), property: "QuantitaDisp", type: "number" }
        ];

        const oSettings = {
            workbook: { columns: aCols },
            dataSource: oRowBinding,      
            fileName: "Export_Articoli.xlsx",
            worker: false                 
        };

        const oSheet = new Spreadsheet(oSettings);
        oSheet.build().finally(() => {
            oSheet.destroy(); 
        });
    }
    
    // ========================================================================
    // RICERCA FILTRATA ARTICOLI (PER NOME)
    // ========================================================================
    public onSearchArticle(oEvent: UI5Event): void {
        const aFilters: Filter[] = [];
        const sQuery = (oEvent.getSource() as SearchField).getValue();

        // Se c'è del testo, creiamo il filtro
        if (sQuery && sQuery.length > 0) {
            aFilters.push(new Filter("NomeArticolo", FilterOperator.Contains, sQuery));
        }

        // Recuperiamo la tabella e applichiamo il filtro
        const oTable = this.byId("articlesTable") as Table;
        oTable.getBinding("items")?.filter(aFilters);
    }
}