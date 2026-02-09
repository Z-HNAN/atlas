## ADDED Requirements

### Requirement: Top navigation visible only in sub-app view
The parent container SHALL display top navigation ONLY when inside a sub-app route.

#### Scenario: No navigation on home page
- **WHEN** the user is on the home page
- **THEN** no top navigation bar is displayed

#### Scenario: Navigation shows in sub-app
- **WHEN** the user is inside a sub-app route
- **THEN** the top navigation shows with Home button on the left and sub-app name centered

### Requirement: Sub-app name centered in navigation
The top navigation SHALL display the sub-app name as centered text with the Home button on the left.

#### Scenario: Centered layout
- **WHEN** the user is in a sub-app
- **THEN** the Home button appears on the left and the sub-app name is centered in the navigation bar

### Requirement: Compact navigation height
The top navigation SHALL use a compact height to reduce vertical space usage.

#### Scenario: Compact height
- **WHEN** the top navigation is rendered
- **THEN** the navigation bar height is compact compared to the main content area

### Requirement: Home button visible only in sub-app
The top navigation SHALL include a Home button ONLY when inside a sub-app route.

#### Scenario: No home button on home page
- **WHEN** the user is on the home page or settings page
- **THEN** no Home button is displayed

#### Scenario: Home button in sub-app view
- **WHEN** the user is inside a sub-app route
- **THEN** the Home button is visible and navigates back to home page

### Requirement: Home button uses icon
The Home button SHALL be displayed as a house icon rather than text.

#### Scenario: Icon button
- **WHEN** the user is in a sub-app
- **THEN** the Home control shows a house icon
