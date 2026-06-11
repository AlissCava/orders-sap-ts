import type {SuiteConfiguration} from "sap/ui/test/starter/config";
export default {
	name: "QUnit test suite for the UI5 Application: orders",
	defaults: {
		page: "ui5://test-resources/orders/Test.qunit.html?testsuite={suite}&test={name}",
		qunit: {
			version: 2
		},
		sinon: {
			version: 4
		},
		ui5: {
			language: "EN",
			theme: "sap_horizon"
		},
		coverage: {
			only: ["orders/"],
			never: ["test-resources/orders/"]
		},
		loader: {
			paths: {
				"orders": "../"
			}
		}
	},
	tests: {
		"unit/unitTests": {
			title: "Unit tests for orders"
		},
		"integration/opaTests": {
			title: "Integration tests for orders"
		}
	}
} satisfies SuiteConfiguration;