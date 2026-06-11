import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Fragment from "sap/ui/core/Fragment";
import UI5Event from "sap/ui/base/Event";
import History from "sap/ui/core/routing/History";

/**
 * Controller per la gestione del Form Ordini (Creazione e Modifica).
 * Gestisce la testata dell'ordine e una tabella di articoli in memoria locale
 * prima di inviare tutto al backend SAP tramite Deep Insert.
 * @namespace orders.controller
 */
export default class OrderForm extends BaseController {

    // ========================================================================
    // 1. CICLO DI VITA E NAVIGAZIONE
    // ========================================================================

    public onInit(): void {
        this.getRouter().getRoute("RouteOrderForm")?.attachPatternMatched(this._onRouteMatched, this);
    }

    private _onRouteMatched(oEvent: UI5Event): void {
        const sObjectId = oEvent.getParameter("arguments").objectId;
        const bIsNew = (sObjectId === "new");
        
        const oViewModel = new JSONModel({
            isNew: bIsNew,
            viewTitle: bIsNew ? this.getText("btnNewOrder") : this.getText("lblOrderNo") + " " + sObjectId
        });
        this.setModel(oViewModel, "viewModel");

        if (bIsNew) {
            this._createEmptyForm(); 
        } else {
            this._loadOrderData(sObjectId); 
        }
    }

    // ========================================================================
    // 2. LOGICA DATI E COMUNICAZIONE ODATA
    // ========================================================================

    private _createEmptyForm(): void {
        const oEmptyOrder = {
            NumOrdine: "Auto-generated",
            Cliente: "",
            StatoTxt: "Nuovo", 
            ImportoTot: 0,
            Articoli: [] 
        };

        this.setModel(new JSONModel(oEmptyOrder), "formModel");
    }

    private async _loadOrderData(sOrderId: string): Promise<void> {
        sap.ui.core.BusyIndicator.show(0);
        const iOrderId = parseInt(sOrderId, 10);
        const aFilters = [new Filter("NumOrdine", FilterOperator.EQ, iOrderId)];

        try {
            // Lettura testata e dettagli in sequenza
            const oHeaderResult = await this.odataRead("/ZES_lista_ordiniSet", { filters: aFilters });
            
            if (!oHeaderResult.results || oHeaderResult.results.length === 0) {
                throw new Error("Ordine non trovato");
            }

            const oHeaderData = oHeaderResult.results[0];
            const oOrderData = {
                NumOrdine: oHeaderData.NumOrdine,
                Cliente: oHeaderData.Cliente,
                StatoTxt: oHeaderData.StatoTxt,
                ImportoTot: oHeaderData.ImportoTot,
                Articoli: []
            };

            try {
                const oItemsData = await this.odataRead("/ZES_dettagli_ordiniSet", { filters: aFilters });
                oOrderData.Articoli = oItemsData.results || [];
            } catch (e) {
                MessageBox.warning("Articoli non caricati.");
            }

            this.setModel(new JSONModel(oOrderData), "formModel");
        } catch (oError) {
            this.handleBackendError(oError);
            this.onNavBack();
        } finally {
            sap.ui.core.BusyIndicator.hide();
        }
    }

    // ========================================================================
    // 3. GESTIONE DIALOG AGGIUNTA ARTICOLO
    // ========================================================================
    
    public async onAddArticleToOrder(): Promise<void> {
        const oView = this.getView();

        if (!this.byId("articleDialog")) {
            const oDialog = await Fragment.load({
                id: oView.getId(),
                name: "orders.view.AddArticleDialog",
                controller: this 
            }) as any;
            oView.addDependent(oDialog);
            this._clearDialogFields();
            oDialog.open();
        } else {
            this._clearDialogFields();
            (this.byId("articleDialog") as any).open();
        }
    }

    private _clearDialogFields(): void {
        (this.byId("inputDialogCode") as any)?.setValue("");
        (this.byId("inputDialogQty") as any)?.setValue("1");
        (this.byId("inputDialogName") as any)?.setValue("");
        (this.byId("inputDialogPrice") as any)?.setValue("");
    }

    public onConfirmAddArticle(): void {
        const sCode = (this.byId("inputDialogCode") as any).getValue();
        const sQty = (this.byId("inputDialogQty") as any).getValue();
        const sName = (this.byId("inputDialogName") as any).getValue();
        const sPrice = (this.byId("inputDialogPrice") as any).getValue();

        if (!sCode || !sQty) {
            MessageBox.warning(this.getText("msgErrorFieldsEmpty"));
            return;
        }

        const oNewRow = {
            CodArticolo: parseInt(sCode, 10),
            NomeArticolo: sName || "Articolo Sconosciuto",
            QuantitaOrdine: parseInt(sQty, 10),
            Importo: parseFloat(sPrice) || 0
        };

        const oFormModel = this.getModel("formModel") as JSONModel;
        const aArticles = oFormModel.getProperty("/Articoli") as any[];
        
        aArticles.push(oNewRow);
        oFormModel.setProperty("/Articoli", aArticles);
        this._recalculateTotal(oFormModel);

        (this.byId("articleDialog") as any).close();
    }

    public onCancelAddArticle(): void {
        (this.byId("articleDialog") as any).close();
    }

    private _recalculateTotal(oFormModel: JSONModel): void {
        const aArticles = oFormModel.getProperty("/Articoli") as any[];
        let fTotal = 0;
        
        aArticles.forEach((item) => {
            const iQty = parseInt(item.QuantitaOrdine, 10) || 1;
            const fPrice = parseFloat(item.Importo) || 0;
            fTotal += (iQty * fPrice);
        });
        
        oFormModel.setProperty("/ImportoTot", fTotal.toFixed(2));
    }

    // ========================================================================
    // 4. SALVATAGGIO FINALE (DEEP INSERT)
    // ========================================================================

    public async onSave(): Promise<void> {
        const oFormModel = this.getModel("formModel") as JSONModel;
        const oViewModel = this.getModel("viewModel") as JSONModel;

        const oFormData = oFormModel.getData();
        const bIsNew = oViewModel.getProperty("/isNew");

        if (!oFormData.Cliente || oFormData.Cliente.trim() === "") {
            MessageBox.error(this.getText("msgErrorFieldsEmpty"));
            return;
        }

        const aItemsSap: any[] = [];
        let fTotalAmount = 0;

        if (oFormData.Articoli && oFormData.Articoli.length > 0) {
            oFormData.Articoli.forEach((item: any) => {
                const iQty = parseInt(item.QuantitaOrdine, 10) || 1;
                const fPrice = parseFloat(item.Importo) || 0;
                
                aItemsSap.push({
                    "CodArticolo": parseInt(item.CodArticolo, 10) || 0,
                    "NomeArticolo": item.NomeArticolo || "",
                    "QuantitaOrdine": iQty,
                    "Importo": fPrice
                });
                
                fTotalAmount += (iQty * fPrice);
            });
        }

        let iStato = 1; 
        if (oFormData.StatoTxt === "In Lavorazione") iStato = 2;
        if (oFormData.StatoTxt === "Completato") iStato = 3;

        const sOperation = bIsNew ? "C" : "U"; 
        const iNumOrdine = bIsNew ? 0 : parseInt(oFormData.NumOrdine, 10);

        const oDeepPayload = {
            "Operation": sOperation, 
            "NumOrdine": iNumOrdine,
            "ZET_lista_ordini": {
                "NumOrdine": iNumOrdine,
                "Cliente": oFormData.Cliente,
                "DataOrdine": new Date(), 
                "ImportoTot": fTotalAmount,
                "Stato": iStato
            },
            "ZET_dettagli_ordiniSet": aItemsSap
        };

        sap.ui.core.BusyIndicator.show(0);

        try {
            await this.odataCreate("/ZES_DeepOrdiniSet", oDeepPayload);
            MessageToast.show("Ordine salvato con successo!"); 
            
            this.getOwnerComponent().getModel()?.refresh(true); 
            
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getRouter().navTo("TargetHome", {}, true); 
            }
        } catch (oError) {
            this.handleBackendError(oError); 
        } finally {
            sap.ui.core.BusyIndicator.hide();
        }
    }

    public onCancel(): void {
        this.onNavBack();
    }
}