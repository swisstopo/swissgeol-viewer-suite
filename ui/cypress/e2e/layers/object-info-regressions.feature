Feature: Object info regressions
  Verify object highlights and translated attributes in the rendered viewer.

  Background:
    Given the viewer is fully loaded
    And the data panel is open

  Scenario: Changing opacity while a GeoJSON polygon is highlighted
    Given a blue GeoJSON regression polygon is displayed
    When the regression polygon is clicked on the map
    Then the regression polygon is highlighted
    When its opacity is changed to thirty percent using the slider
    And the object info window is closed
    Then the polygon has its blue base color and thirty percent opacity

  Scenario: Hiding a layer during an attribute language refresh
    Given a localized info layer and another regression layer are displayed
    When the info layer is queried in German
    And French is selected while its attribute response is held
    And the other regression layer is hidden using its eye button
    And the French attribute response is released
    Then the info window displays the French attributes
