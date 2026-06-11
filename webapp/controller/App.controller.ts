import BaseController from "./BaseController";
import UI5Event from "sap/ui/base/Event";
import ToolPage from "sap/tnt/ToolPage";
import NavigationListItem from "sap/tnt/NavigationListItem";

/**
 * @namespace orders.controller
 */
export default class App extends BaseController {

    public onInit(): void {
        // Logica di inizializzazione dell'app
    }

    public onCollapseExpandPress(): void {
        const oToolPage = this.byId("toolPage") as ToolPage;
        if (oToolPage) {
            const bSideExpanded = oToolPage.getSideExpanded();
            oToolPage.setSideExpanded(!bSideExpanded);
        }
    }

    public onItemSelect(oEvent: UI5Event): void {
        const oItem = oEvent.getParameter("item") as NavigationListItem;
        if (oItem) {
            this.getRouter().navTo(oItem.getKey());
        }
    }
}