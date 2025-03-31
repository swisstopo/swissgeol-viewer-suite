Feature: Modify transparency of layer or background
  In order to change the transparency of a layer or of the background map
  As a user I need to activate the transparency slider
  So that I can see through a layer or the terrain

  Background: viewer.swissgeol.ch in up and running and accessible via the internet
    Given the background map or background map and at least one layer is in the data displayed section
    And both background and layer are in the data displayed section of the data panel and visible in the 3D scene

    Scenario: Modify transparency
      When the user clicks on the transparency chip
      Then the transparency slider opens below the background or layer in the data displayed section

      When the user drags the handle of the slider to the left
      Then the transparency of the background or of the layer is increased
      And the percentage value displayed in the transparency chip increases 

      When the user drags the handle of the slider to the right
      Then the transparency of the background or of the layer is decreased
      And the percentage value displayed in the transparency chip decreases 

      When the user clicks on the transparency chip again
      Then the trancparency slider collapses again