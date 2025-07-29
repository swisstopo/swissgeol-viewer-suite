Feature: Hover layer
  As a user of viewer.swissgeol.ch
  I want to get a visual reaction when hovering over the different elements of a layer
  So that I get informed which features are available

    Background:
      Given the viewer is fully loaded
      And one layer is being displayed

    Scenario: Hovering over the layer displayed in the data displayed section
      When the user hovers over a layer in the data displayed section
      Then the background of the layer will be highlighted

      When the user hovers over the eye icon
      Then the icon will be highlighted

      When the user hovers over the opacity chip
      Then the the background of the chip will be highlighted
      And a tooltip will be displayed

      When the user hovers over the context menu
      Then the icon will be highlighted
