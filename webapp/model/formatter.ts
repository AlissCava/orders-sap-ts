export default {
    // ------------------------------------------------------------------------
    // 1. FORMATTAZIONE VALUTA
    // ------------------------------------------------------------------------
    currencyValue: function (sValue: string | number): string {
        if (!sValue) {
            return "0.00 €";
        }
        const fValue = typeof sValue === "string" ? parseFloat(sValue) : sValue;
        return fValue.toFixed(2) + " €";
    },

    // ------------------------------------------------------------------------
    // 2. FORMATTAZIONE COLORE STATO
    // ------------------------------------------------------------------------
    statusState: function (sStatus: string | number): string {
        if (sStatus === "Chiuso" || sStatus === 4) {
            return "Success"; // Verde
        } else if (sStatus === "Cancellato" || sStatus === 4) {
            // Nota: nel tuo file originale avevi sStatus === 4 anche qui. 
            // Se 4 è Cancellato, metti 4 qui e toglilo da "Chiuso" se serve!
            return "Error"; // Rosso
        } else if (sStatus === "Creato") {
            return "Information"; // Azzurro
        } else {
            return "Warning"; // Arancione per "In elaborazione" e "In transito"
        }
    },

    // ------------------------------------------------------------------------
    // 3. FORMATTAZIONE ICONA STATO
    // ------------------------------------------------------------------------
    statusIcon: function (sStatus: string | number): string {
        if (sStatus === "Chiuso" || sStatus === 4) {
            return "sap-icon://sys-enter-2"; // Spunta
        } else if (sStatus === "Cancellato" || sStatus === 4) {
            return "sap-icon://error"; // X rossa
        } else if (sStatus === "Creato") {
            return "sap-icon://add-document"; // Foglio nuovo
        } else if (sStatus === "In transito") {
            return "sap-icon://shipping-status"; // Camioncino
        } else {
            return "sap-icon://in-progress"; // Orologio per "In elaborazione"
        }
    },

    // ------------------------------------------------------------------------
    // 4. FORMATTAZIONE EURO ITALIANO
    // ------------------------------------------------------------------------
    formatItalianEuro: function (sValue: string | number): string {
        if (!sValue) { 
            return "0,00 €"; 
        }
        const fValue = typeof sValue === "string" ? parseFloat(sValue) : sValue;
        if (isNaN(fValue)) {
            return "0,00 €";
        }
        const sFormattedNumber = fValue.toLocaleString('it-IT', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
        return sFormattedNumber + " €";
    },

    // ------------------------------------------------------------------------
    // 5. FORMATTAZIONE DATA (gg/mm/aaaa)
    // ------------------------------------------------------------------------
    formatItalianDate: function (oDate: Date | string | null | undefined): string {
        if (!oDate) {
            return "";
        }

        const d = new Date(oDate);
        
        if (isNaN(d.getTime())) {
            return typeof oDate === "string" ? oDate : "";
        }

        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();

        return day + "/" + month + "/" + year;
    }
};