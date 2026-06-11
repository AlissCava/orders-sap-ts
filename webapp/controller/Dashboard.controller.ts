import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";

/**
 * Controller per la Dashboard.
 * Gestisce il calcolo delle statistiche aggregando i dati degli ordini
 * provenienti dal backend SAP.
 * @namespace orders.controller
 */
export default class Dashboard extends BaseController {

    public onInit(): void {
        this.getRouter().getRoute("RouteDashboard")?.attachPatternMatched(this._onRouteMatched, this);
    }

    private async _onRouteMatched(): Promise<void> {
        sap.ui.core.BusyIndicator.show(0); // Accendiamo il caricamento

        try {
            // CHIAMATA AL BACKEND: Usiamo il wrapper asincrono del BaseController
            const oData = await this.odataRead("/ZES_lista_ordiniSet");
            
            // oData.results contiene l'array dei veri ordini dal server
            const aOrders = oData.results as any[];

            // Creiamo degli oggetti per accumulare i conteggi in modo efficiente
            const oStatusCounts: Record<string, number> = {};
            const oCustomerCounts: Record<string, number> = {};

            // Contiamo i dati analizzando ogni ordine
            aOrders.forEach((oOrder: any) => {
                const sStatus = oOrder.StatoTxt || "Nuovo";
                const sCustomer = oOrder.Cliente || "Sconosciuto";

                oStatusCounts[sStatus] = (oStatusCounts[sStatus] || 0) + 1;
                oCustomerCounts[sCustomer] = (oCustomerCounts[sCustomer] || 0) + 1;
            });

            // Trasformiamo i conteggi in array per i componenti dei grafici (VizFrame o Microcharts)
            const aStatusStats = Object.keys(oStatusCounts).map((sKey) => {
                return { 
                    label: sKey, 
                    value: oStatusCounts[sKey],
                    displayValue: oStatusCounts[sKey].toString() 
                };
            });

            const aCustomerStats = Object.keys(oCustomerCounts).map((sKey) => {
                return { label: sKey, value: oCustomerCounts[sKey] };
            });

            // Creiamo il modello locale per la vista e lo assegniamo
            const oStatsModel = new JSONModel({
                Statuses: aStatusStats,
                Customers: aCustomerStats // Nuova property per i Clienti
            });

            this.setModel(oStatsModel, "statsModel");

        } catch (oError) {
            // In caso di errore, avvisiamo l'utente
            MessageToast.show("Errore nel caricamento dei dati dal server SAP.");
        } finally {
            // Spegniamo sempre il BusyIndicator, anche se c'è un errore
            sap.ui.core.BusyIndicator.hide();
        }
    }
}