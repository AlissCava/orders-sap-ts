import Controller from "sap/ui/core/mvc/Controller";
import History from "sap/ui/core/routing/History";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import Router from "sap/ui/core/routing/Router";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";

/**
 * @namespace orders.controller
 */
export default class BaseController extends Controller {

    // FUNZIONE getRouter: serve per navigare tra le pagine dell'app.
    // Invece di scrivere ogni volta "this.getOwnerComponent().getRouter()", useremo "this.getRouter()".
    public getRouter(): Router {
        return (this.getOwnerComponent() as any).getRouter();
    }

    // FUNZIONE getModel: permette di recuperare un modello dati (JSON o OData).
    // Controlla prima se il modello è nella Vista, altrimenti lo cerca nel Componente globale.
    public getModel(sName?: string): any {
        return this.getView().getModel(sName) || this.getOwnerComponent().getModel(sName);
    }

    // FUNZIONE setModel: scorciatoia per assegnare un modello alla vista corrente.
    public setModel(oModel: any, sName?: string): any {
        return this.getView().setModel(oModel, sName);
    }

    // FUNZIONE getResourceBundle: serve per leggere i testi dal file i18n tramite JavaScript.
    // Indispensabile per mostrare messaggi di errore o conferme tradotte.
    public getResourceBundle(): ResourceBundle {
        return (this.getOwnerComponent().getModel("i18n") as any).getResourceBundle();
    }

    // FUNZIONE getText: una comodissima scorciatoia. 
    // Invece di scrivere sempre "this.getResourceBundle().getText('chiave')", 
    // ora nei controller potremo scrivere semplicemente "this.getText('chiave')".
    public getText(sKey: string, aArgs?: any[]): string {
        return this.getResourceBundle().getText(sKey, aArgs);
    }

    // FUNZIONE onNavBack: gestisce il tasto "Indietro" del browser o dell'app.
    // Se c'è una cronologia precedente, torna indietro, altrimenti riporta alla Home.
    public onNavBack(): void {
        const oHistory = History.getInstance();
        const sPreviousHash = oHistory.getPreviousHash();

        if (sPreviousHash !== undefined) {
            window.history.go(-1); // Torna indietro di un passo nella cronologia
        } else {
            this.getRouter().navTo("RouteHome", {}, true); // Torna alla Home se non c'è cronologia
        }
    }

    // ========================================================================
    // NUOVE FUNZIONI: OPERAZIONI CRUD GENERICHE (Wrapper asincroni con Promise)
    // ========================================================================

    // 1. LETTURA (GET) - Chiede i dati a SAP.
    public odataRead(sPath: string, oUrlParams?: any): Promise<any> {
        const oModel = this.getModel() as ODataModel; 
        
        return new Promise((resolve, reject) => {
            oModel.read(sPath, {
                urlParameters: oUrlParams, 
                success: (oData: any) => resolve(oData), 
                error: (oError: any) => reject(oError) 
            });
        });
    }

    // 2. CREAZIONE (POST) - Invia un nuovo record al database SAP.
    public odataCreate(sPath: string, oPayload: any): Promise<any> {
        const oModel = this.getModel() as ODataModel;
        
        return new Promise((resolve, reject) => {
            oModel.create(sPath, oPayload, {
                success: (oData: any) => resolve(oData), 
                error: (oError: any) => reject(oError) 
            });
        });
    }

    // 3. AGGIORNAMENTO (PUT) - Modifica un record già esistente su SAP.
    public odataUpdate(sPath: string, oPayload: any): Promise<void> {
        const oModel = this.getModel() as ODataModel;
        
        return new Promise((resolve, reject) => {
            oModel.update(sPath, oPayload, {
                success: () => resolve(), 
                error: (oError: any) => reject(oError) 
            });
        });
    }

    // 4. ELIMINAZIONE (DELETE) - Cancella un record da SAP.
    public odataDelete(sPath: string): Promise<void> {
        const oModel = this.getModel() as ODataModel;
        
        return new Promise((resolve, reject) => {
            oModel.remove(sPath, {
                success: () => resolve(), 
                error: (oError: any) => reject(oError) 
            });
        });
    }

    // FUNZIONE GENERICA DI GESTIONE ERRORI
    public handleBackendError(oError: any): void {
        let sMessage = this.getText("msgErrorBackend"); 
        
        try {
            if (oError && oError.responseText) {
                const oResponse = JSON.parse(oError.responseText);
                if (oResponse && oResponse.error && oResponse.error.message && oResponse.error.message.value) {
                    sMessage = oResponse.error.message.value;
                }
            }
        } catch (e) {
            // Ignoriamo errori di parsing
        }
        
        MessageBox.error(sMessage);
    }
}