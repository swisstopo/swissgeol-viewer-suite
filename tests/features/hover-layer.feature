Feature: Hover layer
  As a user of viewer.swissgeol.ch
  I want to get a visual reaction when hovering over the different elements of a layer
  So that I get informed which features are available

    Background: viewer.swissgeol.ch in up and running and accessible via the internet
      Given the user has at least one layer in the data displayed section

    Scenario: Hovering over the layer displayed in the data displayed section
      When the user hovers over a layer in the data displayed section
      Then the background of the layer will be highlighted  # What is the correct color description? See Figma

      When the user hovers over the eye icon
      Then the icon will be highlighted # What is the correct color description? See Figma

      When the user hovers over percentation chip of th opacity
      Then the the background of the chip will be highlited # What is the correct color description? See Figma?
      And a tooltip will be displayed showing the its meaning (opacity) above the chip

      When hovering contect menu ...

      When clicking eye icon ...