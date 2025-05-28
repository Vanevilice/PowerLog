
export const NONE_SEALINE_VALUE = "__NONE_SEALINE__";
export const CONTAINER_TYPES_CONST = ["20DC", "40HC"] as const;
export const SHIPMENT_TYPES_CONST = ["COC", "SOC"] as const;
export const CALCULATION_MODES_CONST = ["sea_plus_rail", "direct_rail"] as const;

export const VLADIVOSTOK_VARIANTS = ['Владивосток (ВМПП)', 'Владивосток (ПЛ)', 'Владивосток (ВМКТ)', 'Владивосток'];
export const USD_RUB_CONVERSION_RATE = 80; // Consider making this dynamic or configurable

export const DROP_OFF_TRIGGER_PHRASES = [
  "не вкл. дроп офф", "не включая дроп офф", "без учёта дроп офф", "не вкл. дропп офф"
].map(phrase => phrase.trim().toLowerCase());

export const DEFAULT_SEA_RAIL_FORM_VALUES = {
  shipmentType: "COC" as const,
  originPort: "",
  destinationPort: "",
  seaLineCompany: NONE_SEALINE_VALUE,
  containerType: undefined,
  russianDestinationCity: "",
  arrivalStationSelection: "",
};

export const DEFAULT_DIRECT_RAIL_FORM_VALUES = {
  directRailAgentName: "",
  directRailCityOfDeparture: "",
  directRailDestinationCityDR: "",
  directRailIncoterms: "",
  directRailBorder: "",
};
