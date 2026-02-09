## ADDED Requirements

### Requirement: Shell provides base layout
The parent container SHALL render a base layout consisting of a top navigation area and a main content area.

#### Scenario: Initial render
- **WHEN** the parent container starts
- **THEN** it renders the top navigation area and the main content area

### Requirement: Garfish initializes with configured apps
The parent container SHALL initialize Garfish and register all configured sub-apps using name and url configuration before navigation occurs.

#### Scenario: Initialization with saved config
- **WHEN** stored sub-app configuration is available
- **THEN** Garfish registers each sub-app using the stored name and url configuration

### Requirement: Garfish loads sub-app content
The parent container SHALL use Garfish to load and render sub-app content into the designated DOM container without applying any size or layout constraints.

#### Scenario: Sub-app content renders
- **WHEN** the user navigates to a sub-app route
- **THEN** Garfish loads the sub-app entry and renders its content in the container

#### Scenario: Sub-app controls own layout
- **WHEN** a sub-app is loaded
- **THEN** the parent container does not apply any CSS styling to the sub-app container element

### Requirement: Home route renders navigation page
The parent container SHALL provide a home route that displays a navigation page with sub-app cards in a grid layout.

#### Scenario: Navigate to home
- **WHEN** the route is the home path
- **THEN** the navigation page displays all configured sub-apps as clickable cards

#### Scenario: Empty state on home
- **WHEN** no sub-apps are configured
- **THEN** the home page shows an empty state message and the add button
