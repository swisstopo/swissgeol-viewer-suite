Feature: Change background map
  In order to change the background map
  As a user I need to activate the background switcher

  Background: viewer.swissgeol.ch in up and running and accessible via the internet
    Given the topographic map is displayed in the 3D scene
    
    Scenario: Change background map
      When the user clicks on the background chip
      Then the background switcher opens below the background layer in the data displayed section
      And the three options are displayed

      When the user clicks on the left thumpnail
      Then the background map changes to swissimage orthophoto

      When the user clicks on the middle thumpnail
      Then the background map changes to topographic map

      When the user clicks on the right thumpnail
      Then the background map changes to rivers and lakes and transparent background

      When the user clicks on the background chip again
      Then the background switcher collapses
