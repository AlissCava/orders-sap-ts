import JSONModel from "sap/ui/model/json/JSONModel";
import Device from "sap/ui/Device";
import BindingMode from "sap/ui/model/BindingMode";

export default {
    /**
     * Provides runtime information for the device the UI5 app is running on as a JSONModel.
     * @returns The device model.
     */
    createDeviceModel: function (): JSONModel {
        const oModel = new JSONModel(Device);
        oModel.setDefaultBindingMode(BindingMode.OneWay);
        return oModel;
    }
};