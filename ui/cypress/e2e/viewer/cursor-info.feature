Feature: Cursor Info
  As a user,
  I want to hover the map to get information about my cursor's position.

  Background:
    Given the viewer is fully loaded
    And no cursor info is shown

  Scenario: Show terrain height
    When the map has been loaded in
    When the cursor is moved over the map
    Then the terrain height is shown

  Scenario: Show object height
    When the top_omm layer has been activated
    And the terrain is hidden
    When the cursor is moved over the map
    Then the object height is shown
