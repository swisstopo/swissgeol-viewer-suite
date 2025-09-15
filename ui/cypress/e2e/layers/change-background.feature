Feature: Change background map
  In order to change the background map
  As a user I need to activate the background switcher

  Background:
    Given the viewer is fully loaded
    And the topographic map is displayed in the 3D scene
    And the layer panel is open

  Scenario: Change background map
    When the user clicks on the background chip
    Then the background switcher opens below the layer
    And the three options are displayed

    When the user clicks on the orthographic thumbnail
    Then the background map changes to swissimage orthophoto

    When the user clicks on the topographic thumbnail
    Then the background map changes to topographic map

    When the user clicks on the rivers and lakes thumbnail
    Then the background map changes to rivers and lakes

    When the user clicks on the background chip
    Then the background switcher collapses
