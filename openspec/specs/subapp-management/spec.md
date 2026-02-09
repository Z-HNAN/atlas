## ADDED Requirements

### Requirement: Home page displays sub-app cards
The home page SHALL display all configured sub-apps as clickable cards in a grid layout.

#### Scenario: View sub-app cards
- **WHEN** the user is on the home page
- **THEN** each sub-app is shown as a card with its name

#### Scenario: Click sub-app card
- **WHEN** the user clicks a sub-app card
- **THEN** the user navigates to that sub-app route

### Requirement: Add button shown as card on home page
The home page SHALL display a [+] card alongside sub-app cards for adding new sub-apps.

#### Scenario: Add card visible
- **WHEN** the user is on the home page
- **THEN** a [+] card is visible in the grid

#### Scenario: Click add card
- **WHEN** the user clicks the [+] card
- **THEN** the user navigates to the add sub-app form page

### Requirement: Sub-app card supports delete with confirmation
Each sub-app card SHALL include a delete control that requires confirmation before removal.

#### Scenario: Delete confirmation
- **WHEN** the user clicks the delete control on a sub-app card
- **THEN** the system asks for confirmation before deleting

#### Scenario: Confirm delete
- **WHEN** the user confirms the deletion
- **THEN** the sub-app is removed from the configuration and disappears from the home page

#### Scenario: Cancel delete
- **WHEN** the user cancels the deletion
- **THEN** the sub-app remains in the configuration and on the home page

### Requirement: User can add a sub-app
The add sub-app page SHALL provide a form to add a sub-app with required fields: name and url.

#### Scenario: Add valid sub-app
- **WHEN** the user submits a form with name and url
- **THEN** the sub-app is added to the configuration list and user returns to home

#### Scenario: Add invalid sub-app
- **WHEN** any required field is missing
- **THEN** the form prevents submission and shows a validation message

### Requirement: Sub-app configuration persists locally
The parent container SHALL persist sub-app configuration locally and restore it on next load.

#### Scenario: Reload restores configuration
- **WHEN** the parent container reloads
- **THEN** it restores the sub-app configuration from local persistence
