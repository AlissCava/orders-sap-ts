import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import UI5Event from "sap/ui/base/Event";

/**
 * Controller per la gestione del Form Articoli (Creazione e Modifica).
 * Gestisce il calcolo automatico dei codici articolo e il salvataggio su backend.
 * @namespace orders.controller
 */
export default class ArticleForm extends BaseController {

    // ========================================================================
    // 1. INIZIALIZZAZIONE E GESTIONE URL
    // ========================================================================
    
    public onInit(): void {
        // Aggancia la funzione all'evento di navigazione
        this.getRouter().getRoute("RouteArticleForm")?.attachPatternMatched(this._onRouteMatched, this);
    }

    private _onRouteMatched(oEvent: UI5Event): void {
        // Recupera l'ID passato nell'URL ("new" per creazione, codice numerico per modifica)
        const sObjectId = oEvent.getParameter("arguments").objectId;
        const bIsNew = (sObjectId === "new");
        
        // Modello per gestire lo stato della UI (titoli e modalità form)
        const oViewModel = new JSONModel({
            isNew: bIsNew,
            viewTitle: bIsNew ? this.getText("dialogCreateArticleTitle") : this.getText("dialogEditArticleTitle")
        });
        
        this.setModel(oViewModel, "viewModel");

        if (bIsNew) {
            this._createEmptyForm(); 
        } else {
            this._loadArticleData(sObjectId); 
        }
    }

    // ========================================================================
    // 2. CARICAMENTO DATI
    // ========================================================================
    
    private async _createEmptyForm(): Promise<void> {
        sap.ui.core.BusyIndicator.show(0);

        try {
            // Recuperiamo l'ultimo articolo inserito per calcolare il prossimo ID
            const oData = await this.odataRead("/ZES_articoliSet", {
                "$orderby": "CodArticolo desc",
                "$top": 1
            });

            let iNextCode = 1;
            if (oData.results && oData.results.length > 0) {
                iNextCode = parseInt(oData.results[0].CodArticolo, 10) + 1;
            }

            // Struttura iniziale dell'articolo vuoto
            const oEmptyArticle = {
                CodArticolo: iNextCode,
                NomeArticolo: "",
                Importo: 0,
                QuantitaDisp: 0
            };
            
            this.setModel(new JSONModel(oEmptyArticle), "formModel");
        } catch (oError) {
            this.handleBackendError(oError);
            this.onNavBack();
        } finally {
            sap.ui.core.BusyIndicator.hide();
        }
    }

    private async _loadArticleData(sArticleId: string): Promise<void> {
        sap.ui.core.BusyIndicator.show(0);
        const sPath = `/ZES_articoliSet(${sArticleId})`;

        try {
            const oData = await this.odataRead(sPath);
            this.setModel(new JSONModel(oData), "formModel");
        } catch (oError) {
            this.handleBackendError(oError);
            this.onNavBack();
        } finally {
            sap.ui.core.BusyIndicator.hide();
        }
    }

    // ========================================================================
    // 3. SALVATAGGIO
    // ========================================================================
    
    public async onSave(): Promise<void> {
        const oFormModel = this.getModel("formModel") as JSONModel;
        const oViewModel = this.getModel("viewModel") as JSONModel;

        const oData = oFormModel.getData();
        const bIsNew = oViewModel.getProperty("/isNew");

        // --- VALIDAZIONE ---
        if (!oData.NomeArticolo || oData.NomeArticolo.trim() === "") {
            MessageBox.error(this.getText("msgErrorFieldsEmpty"));
            return;
        }

        // --- PREPARAZIONE DATI ---
        const oPayload = {
            CodArticolo: parseInt(oData.CodArticolo, 10),
            NomeArticolo: oData.NomeArticolo,
            Importo: parseFloat(oData.Importo) || 0,
            QuantitaDisp: parseInt(oData.QuantitaDisp, 10) || 0
        };

        sap.ui.core.BusyIndicator.show(0);

        try {
            if (bIsNew) {
                await this.odataCreate("/ZES_articoliSet", oPayload);
                MessageToast.show(this.getText("msgArticleCreated"));
            } else {
                const sPath = `/ZES_articoliSet(${oPayload.CodArticolo})`;
                await this.odataUpdate(sPath, oPayload);
                MessageToast.show(this.getText("msgArticleUpdated"));
            }
            
            // Aggiorniamo il modello globale e torniamo indietro
            this.getModel().refresh(true);
            this.onNavBack();
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