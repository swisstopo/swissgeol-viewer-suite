Feature: Reorder layers
  As a user of viewer.swissgeol.ch
  I want to change the order of the layers displayed in the data dislyed section
  So that I can see data which are hidden by other

    Background: viewer.swissgeol.ch in up and running and accessible via the internet
      Given the user has activated at least two layers
      And these layers are displayed in the data displayed section and in the 3D scene

    Scenario: Reorder layers


      When the user drags a layer with the handle to the left of the layer name and releases it above another layer in teh data displayed section
      Then the dragged layer will be placed above the other layer in the data displayed section
      And the dragged layer will be displayed above the other layer in the 3D scene