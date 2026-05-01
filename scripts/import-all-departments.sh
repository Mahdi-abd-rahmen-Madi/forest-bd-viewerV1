#!/bin/bash

# Complete Multi-Department Import Workflow Script
# Orchestrates database cleanup, department extraction, and data import

set -euo pipefail  # Exit on error, undefined variables, and pipe failures

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/import-workflow-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Global variables
AUTO_MODE=false
DRY_RUN=false
PHASE_ONLY=""
START_TIME=$(date +%s)

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') | $1" | tee -a "$LOG_FILE"
}

# Print colored output
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Show usage information
show_help() {
    cat << EOF
🌲 Complete Multi-Department Import Workflow

Usage: $0 [OPTIONS]

OPTIONS:
    --auto          Non-interactive mode with automatic confirmations
    --dry-run       Validation mode without actual execution
    --phase PHASE   Run specific phase only (clean|extract|import)
    --help          Show this help message

PHASES:
    clean           Run database cleanup only
    extract         Run department extraction only
    import          Run data import only

EXAMPLES:
    $0                          # Interactive execution
    $0 --auto                   # Non-interactive execution
    $0 --dry-run                # Validation mode
    $0 --phase clean            # Clean database only
    $0 --phase extract          # Extract departments only
    $0 --phase import           # Import data only

EOF
}

# Validate prerequisites
validate_prerequisites() {
    print_header "Validating Prerequisites"
    
    log "Starting prerequisite validation..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        log "ERROR: Node.js not found"
        exit 1
    fi
    print_success "Node.js: $(node --version)"
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not installed"
        log "ERROR: pnpm not found"
        exit 1
    fi
    print_success "pnpm: $(pnpm --version)"
    
    # Check 7z
    if ! command -v 7z &> /dev/null; then
        print_warning "7z is not installed"
        log "WARNING: 7z not found - will attempt to install"
        print_info "Attempting to install 7z..."
        if sudo apt-get update && sudo apt-get install -y p7zip-full; then
            print_success "7z installed successfully"
        else
            print_error "Failed to install 7z"
            log "ERROR: Failed to install 7z"
            exit 1
        fi
    else
        print_success "7z: $(7z | head -n1)"
    fi
    
    # Check project structure
    if [[ ! -f "$PROJECT_ROOT/scripts/clean-database.js" ]]; then
        print_error "clean-database.js not found"
        log "ERROR: clean-database.js missing"
        exit 1
    fi
    
    if [[ ! -f "$PROJECT_ROOT/scripts/extract-departments.js" ]]; then
        print_error "extract-departments.js not found"
        log "ERROR: extract-departments.js missing"
        exit 1
    fi
    
    if [[ ! -f "$PROJECT_ROOT/scripts/import-shapefiles.js" ]]; then
        print_error "import-shapefiles.js not found"
        log "ERROR: import-shapefiles.js missing"
        exit 1
    fi
    
    # Check dependencies
    print_info "Checking Node.js dependencies..."
    cd "$PROJECT_ROOT"
    if ! pnpm list --prod > /dev/null 2>&1; then
        print_warning "Installing missing dependencies..."
        if pnpm install; then
            print_success "Dependencies installed"
        else
            print_error "Failed to install dependencies"
            log "ERROR: Dependency installation failed"
            exit 1
        fi
    fi
    
    print_success "Prerequisites validation completed"
    log "Prerequisites validation completed successfully"
}

# Clean database phase
clean_database() {
    print_header "Phase 1: Database Cleanup"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "DRY RUN: Would clean database"
        log "DRY RUN: Database cleanup skipped"
        return 0
    fi
    
    log "Starting database cleanup..."
    
    cd "$PROJECT_ROOT"
    
    # Run database cleanup with automatic confirmation in auto mode
    if [[ "$AUTO_MODE" == "true" ]]; then
        print_info "Running database cleanup (auto mode)..."
        node scripts/clean-database.js --auto 2>&1 | tee -a "$LOG_FILE"
    else
        print_info "Running database cleanup (interactive)..."
        node scripts/clean-database.js 2>&1 | tee -a "$LOG_FILE"
    fi
    
    # Check if cleanup was successful
    if [[ ${PIPESTATUS[0]} -eq 0 ]]; then
        print_success "Database cleanup completed"
        log "Database cleanup completed successfully"
    else
        print_error "Database cleanup failed"
        log "ERROR: Database cleanup failed"
        exit 1
    fi
}

# Extract departments phase
extract_departments() {
    print_header "Phase 2: Department Extraction"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "DRY RUN: Would extract departments"
        log "DRY RUN: Department extraction skipped"
        return 0
    fi
    
    log "Starting department extraction..."
    
    cd "$PROJECT_ROOT"
    
    # Run department extraction
    if [[ "$AUTO_MODE" == "true" ]]; then
        print_info "Running department extraction (auto mode)..."
        echo "y" | node scripts/extract-departments.js 2>&1 | tee -a "$LOG_FILE"
    else
        print_info "Running department extraction (interactive)..."
        node scripts/extract-departments.js 2>&1 | tee -a "$LOG_FILE"
    fi
    
    # Check if extraction was successful
    if [[ ${PIPESTATUS[0]} -eq 0 ]]; then
        print_success "Department extraction completed"
        log "Department extraction completed successfully"
        
        # Show extraction status
        print_info "Checking extraction status..."
        node scripts/extract-departments.js --status 2>&1 | tee -a "$LOG_FILE"
    else
        print_error "Department extraction failed"
        log "ERROR: Department extraction failed"
        exit 1
    fi
}

# Import data phase
import_data() {
    print_header "Phase 3: Data Import"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "DRY RUN: Would import data"
        log "DRY RUN: Data import skipped"
        return 0
    fi
    
    log "Starting data import..."
    
    cd "$PROJECT_ROOT"
    
    # Run data import
    print_info "Running multi-department import..."
    node scripts/import-shapefiles.js 2>&1 | tee -a "$LOG_FILE"
    
    # Check if import was successful
    if [[ ${PIPESTATUS[0]} -eq 0 ]]; then
        print_success "Data import completed"
        log "Data import completed successfully"
    else
        print_error "Data import failed"
        log "ERROR: Data import failed"
        exit 1
    fi
}

# Generate final summary
generate_summary() {
    print_header "Workflow Summary"
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    HOURS=$((DURATION / 3600))
    MINUTES=$(((DURATION % 3600) / 60))
    SECONDS=$((DURATION % 60))
    
    log "Generating workflow summary..."
    
    echo -e "${PURPLE}📊 Workflow Statistics:${NC}"
    echo -e "   Total Duration: ${HOURS}h ${MINUTES}m ${SECONDS}s"
    echo -e "   Log File: $LOG_FILE"
    echo
    
    if [[ "$DRY_RUN" != "true" ]]; then
        # Show final database status
        print_info "Checking final database status..."
        node scripts/clean-database.js --status 2>&1 | tee -a "$LOG_FILE"
    fi
    
    echo -e "${GREEN}🎉 Workflow completed successfully!${NC}"
    log "Workflow completed successfully"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "This was a dry run. No actual changes were made."
        print_info "Run without --dry-run to execute the actual workflow."
    else
        print_info "Your forest database is now ready for analysis!"
        print_info "You can now start the application: pnpm run dev"
    fi
    
    echo
    echo -e "${CYAN}📋 Next Steps:${NC}"
    echo -e "   1. Review the log file: $LOG_FILE"
    echo -e "   2. Start the development server: pnpm run dev"
    echo -e "   3. Open http://localhost:3000 to view the application"
    echo -e "   4. Test forest analysis with the imported data"
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --auto)
                AUTO_MODE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --phase)
                PHASE_ONLY="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Validate phase argument
validate_phase() {
    if [[ -n "$PHASE_ONLY" ]]; then
        case "$PHASE_ONLY" in
            clean|extract|import)
                ;;
            *)
                print_error "Invalid phase: $PHASE_ONLY"
                print_info "Valid phases: clean, extract, import"
                exit 1
                ;;
        esac
    fi
}

# Main execution function
main() {
    print_header "🌲 Complete Multi-Department Import Workflow"
    echo -e "${CYAN}Log file: $LOG_FILE${NC}"
    echo
    
    log "Starting workflow with options: AUTO=$AUTO_MODE, DRY_RUN=$DRY_RUN, PHASE=$PHASE_ONLY"
    
    # Parse and validate arguments
    parse_args "$@"
    validate_phase
    
    # Show dry run warning
    if [[ "$DRY_RUN" == "true" ]]; then
        print_warning "DRY RUN MODE - No actual changes will be made"
        echo
    fi
    
    # Show auto mode info
    if [[ "$AUTO_MODE" == "true" ]]; then
        print_info "AUTO MODE - All confirmations will be automatically answered"
        echo
    fi
    
    # Validate prerequisites
    validate_prerequisites
    echo
    
    # Execute phases based on arguments
    if [[ -n "$PHASE_ONLY" ]]; then
        print_info "Running single phase: $PHASE_ONLY"
        echo
        case "$PHASE_ONLY" in
            clean)
                clean_database
                ;;
            extract)
                extract_departments
                ;;
            import)
                import_data
                ;;
        esac
    else
        # Run all phases
        clean_database
        echo
        extract_departments
        echo
        import_data
    fi
    
    echo
    generate_summary
}

# Error handling trap
trap 'print_error "Script failed at line $LINENO"' ERR

# Run main function with all arguments
main "$@"
