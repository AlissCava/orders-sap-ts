import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import UI5Event from "sap/ui/base/Event";

/**
 * Controller per la visualizzazione dettagliata di un Ordine.
 * Utilizza una Deep Insert (Operation 'R') per leggere sia la testata che le posizioni in un unico colpo.
 * @namespace orders.controller
 */
export default class OrderDetail extends BaseController {

    public onInit(): void {
        // Creiamo il modello locale per i dettagli dell'ordine
        const oDetailModel = new JSONModel();
        this.getView().setModel(oDetailModel, "detailModel");

        // Agganciamo la rotta per intercettare il passaggio dell'ID ordine
        this.getRouter().getRoute("RouteOrderDetail")?.attachPatternMatched(this._onObjectMatched, this);
    }

    private async _onObjectMatched(oEvent: UI5Event): Promise<void> {
        // Recuperiamo l'ID dall'URL della rotta
        const sOrderId = oEvent.getParameter("arguments").orderId;
        const iOrderId = parseInt(sOrderId, 10);
        
        const oDetailModel = this.getView().getModel("detailModel") as JSONModel;

        // Svuotiamo il modello prima di caricare i nuovi dati per evitare residui visivi
        oDetailModel.setData({});

        // Il payload speciale per forzare la Read tramite una Create (Operation: R)
        // Questo è lo standard per comunicare con il tuo specifico OData Deep Insert
        const oReadPayload = {
            "Operation": "R",
            "NumOrdine": iOrderId,
            "ZET_lista_ordini": {
                "NumOrdine": iOrderId,
                "Cliente": "",
                "DataOrdine": new Date(),
                "ImportoTot": 0,
                "Stato": 0
            },
            "ZET_dettagli_ordiniSet": []
        };

        sap.ui.core.BusyIndicator.show(0);

        try {
            // Chiamata asincrona al backend (grazie al wrapper nel BaseController)
            const oData = await this.odataCreate("/ZES_DeepOrdiniSet", oReadPayload);
            
            // Estraiamo gli articoli in modo sicuro, gestendo i diversi formati di risposta
            let aArticles: any[] = []; 
            if (oData.ZET_dettagli_ordiniSet && oData.ZET_dettagli_ordiniSet.results) {
                aArticles = oData.ZET_dettagli_ordiniSet.results;
            } else if (Array.isArray(oData.ZET_dettagli_ordiniSet)) {
                aArticles = oData.ZET_dettagli_ordiniSet;
            }

            // Impacchettiamo i dati in un formato pulito per la vista XML.
            // Manteniamo le chiavi originali perché il binding XML punta a queste.
            const oCleanData = {
                Cliente: oData.ZET_lista_ordini ? oData.ZET_lista_ordini.Cliente : "",
                ImportoTot: oData.ZET_lista_ordini ? oData.ZET_lista_ordini.ImportoTot : 0,
                NumOrdine: oData.NumOrdine,
                StatoTxt: oData.ZET_lista_ordini ? oData.ZET_lista_ordini.StatoTxt : "",
                Articoli: aArticles
            };

            // Popoliamo il modello, il quale aggiornerà automaticamente la UI
            oDetailModel.setData(oCleanData);

        } catch (oError) {
            // Gestione centralizzata degli errori tramite BaseController
            this.handleBackendError(oError);
        } finally {
            sap.ui.core.BusyIndicator.hide();
        }
    }

    public onNavBack(): void {
        this.getRouter().navTo("RouteHome", {}, true);
    }
}