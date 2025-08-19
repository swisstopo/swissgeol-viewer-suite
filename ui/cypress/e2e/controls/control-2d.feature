Feature: Use 2D Control

  Background:
    Given the viewer is fully loaded
    Then the map is in 3d mode
    And the 2d control shows the 3d icon

    Scenario: Switch to 2D mode
      When the user clicks on the 2d control
      Then the map is in 2d mode
      And the 2d control shows the 3d icon

    Scenario: Switch back to 3D mode
      When the user clicks on the 2d control
      And the user clicks on the 2d control
      Then the map is in 3d mode
      And the 2d control shows the 2d icon


