Feature: Exaggeration
  As a user,
  I want to be able to change the map's exaggeration.

  Background:
    Given the viewer is fully loaded
    And the data panel is open

  Scenario: Select exaggeration tab
    When the settings tab is selected
    Then the exaggeration slider is shown
    And the exaggeration is at a factor of 1x

  Scenario: Increase exaggeration
    When the settings tab is selected
    And the exaggeration slider is set to 2.5
    Then the exaggeration is at a factor of 2.5x

  Scenario: Decrease exaggeration
    When the settings tab is selected
    And the exaggeration slider is set to 8
    And the exaggeration slider is set to 6.5
    Then the exaggeration is at a factor of 6.5x

