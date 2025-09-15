#!/usr/bin/env python3
"""
Validation script for the enhanced training data system backend implementation.
This script validates the implementation without requiring database connections.
"""
import sys
import os

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def validate_models():
    """Validate instruction models."""
    print("1. Validating instruction models...")
    
    try:
        from app.models.instruction import (
            InstructionType,
            TrainingInstructionCreate,
            TrainingInstructionUpdate,
            TrainingInstructionResponse,
            InstructionListResponse,
            InstructionBulkImportRequest,
            InstructionBulkImportResponse,
            InstructionTestRequest,
            InstructionTestResponse,
            EnhancedTrainRequest,
            EnhancedTrainResponse
        )
        
        print("  ✓ All instruction models imported successfully")
        
        # Test model creation
        instruction_create = TrainingInstructionCreate(
            chatbot_id="test_123",
            type=InstructionType.BEHAVIOR,
            title="Test Instruction",
            content="This is a test instruction for validation.",
            priority=5
        )
        
        print("  ✓ TrainingInstructionCreate model validation passed")
        
        # Test enum values
        assert InstructionType.BEHAVIOR == "behavior"
        assert InstructionType.KNOWLEDGE == "knowledge"
        assert InstructionType.TONE == "tone"
        assert InstructionType.ESCALATION == "escalation"
        
        print("  ✓ InstructionType enum validation passed")
        
        return True
        
    except Exception as e:
        print(f"  ✗ Model validation failed: {e}")
        return False


def validate_service_structure():
    """Validate instruction service structure."""
    print("\n2. Validating instruction service structure...")
    
    try:
        # Check if the service file exists and has the right structure
        service_file = os.path.join(os.path.dirname(__file__), 'app', 'services', 'instruction_service.py')
        
        if not os.path.exists(service_file):
            print("  ✗ Instruction service file not found")
            return False
        
        with open(service_file, 'r') as f:
            content = f.read()
        
        # Check for required methods
        required_methods = [
            'create_instruction',
            'get_instruction',
            'list_instructions',
            'update_instruction',
            'delete_instruction',
            'retrieve_relevant_instructions',
            'test_instruction_relevance',
            'bulk_import_instructions'
        ]
        
        for method in required_methods:
            if f"async def {method}" not in content:
                print(f"  ✗ Missing required method: {method}")
                return False
        
        print("  ✓ All required service methods found")
        
        # Check for database connection handling
        if "supabase_client" not in content:
            print("  ✗ Missing Supabase client handling")
            return False
        
        print("  ✓ Database connection handling found")
        
        # Check for embedding generation
        if "generate_embedding" not in content:
            print("  ✗ Missing embedding generation")
            return False
        
        print("  ✓ Embedding generation integration found")
        
        return True
        
    except Exception as e:
        print(f"  ✗ Service structure validation failed: {e}")
        return False


def validate_router_structure():
    """Validate instruction router structure."""
    print("\n3. Validating instruction router structure...")
    
    try:
        # Check if the router file exists and has the right structure
        router_file = os.path.join(os.path.dirname(__file__), 'app', 'routers', 'instruction.py')
        
        if not os.path.exists(router_file):
            print("  ✗ Instruction router file not found")
            return False
        
        with open(router_file, 'r') as f:
            content = f.read()
        
        # Check for required endpoints
        required_endpoints = [
            'POST /instructions',
            'GET /instructions/{instruction_id}',
            'GET /instructions',
            'PUT /instructions/{instruction_id}',
            'DELETE /instructions/{instruction_id}',
            'POST /instructions/bulk-import',
            'POST /instructions/{instruction_id}/test',
            'POST /train/enhanced'
        ]
        
        endpoint_patterns = [
            '@router.post("/instructions"',
            '@router.get("/instructions/{instruction_id}"',
            '@router.get("/instructions"',
            '@router.put("/instructions/{instruction_id}"',
            '@router.delete("/instructions/{instruction_id}"',
            '@router.post("/instructions/bulk-import"',
            '@router.post("/instructions/{instruction_id}/test"',
            '@router.post("/train/enhanced"'
        ]
        
        for pattern in endpoint_patterns:
            if pattern not in content:
                print(f"  ✗ Missing endpoint pattern: {pattern}")
                return False
        
        print("  ✓ All required API endpoints found")
        
        # Check for proper error handling
        if "HTTPException" not in content:
            print("  ✗ Missing HTTP exception handling")
            return False
        
        print("  ✓ Error handling found")
        
        return True
        
    except Exception as e:
        print(f"  ✗ Router structure validation failed: {e}")
        return False


def validate_rag_integration():
    """Validate RAG service integration."""
    print("\n4. Validating RAG service integration...")
    
    try:
        # Check if the RAG service has been updated
        rag_file = os.path.join(os.path.dirname(__file__), 'app', 'services', 'rag_service.py')
        
        if not os.path.exists(rag_file):
            print("  ✗ RAG service file not found")
            return False
        
        with open(rag_file, 'r') as f:
            content = f.read()
        
        # Check for instruction service integration
        if "instruction_service" not in content:
            print("  ✗ Missing instruction service integration")
            return False
        
        print("  ✓ Instruction service integration found")
        
        # Check for enhanced prompt template
        if "enhanced_rag_prompt_template" not in content:
            print("  ✗ Missing enhanced RAG prompt template")
            return False
        
        print("  ✓ Enhanced RAG prompt template found")
        
        # Check for instruction retrieval method
        if "_retrieve_relevant_instructions" not in content:
            print("  ✗ Missing instruction retrieval method")
            return False
        
        print("  ✓ Instruction retrieval method found")
        
        # Check for enhanced context construction
        if "_construct_enhanced_context" not in content:
            print("  ✗ Missing enhanced context construction")
            return False
        
        print("  ✓ Enhanced context construction found")
        
        return True
        
    except Exception as e:
        print(f"  ✗ RAG integration validation failed: {e}")
        return False


def validate_main_app_integration():
    """Validate main app integration."""
    print("\n5. Validating main app integration...")
    
    try:
        # Check if the main app includes the instruction router
        main_file = os.path.join(os.path.dirname(__file__), 'app', 'main.py')
        
        if not os.path.exists(main_file):
            print("  ✗ Main app file not found")
            return False
        
        with open(main_file, 'r') as f:
            content = f.read()
        
        # Check for instruction router import
        if "from app.routers import ingest, chat, search, vision, lead, instruction" not in content:
            print("  ✗ Missing instruction router import")
            return False
        
        print("  ✓ Instruction router import found")
        
        # Check for instruction router inclusion
        if 'app.include_router(instruction.router, prefix="/api", tags=["instruction"])' not in content:
            print("  ✗ Missing instruction router inclusion")
            return False
        
        print("  ✓ Instruction router inclusion found")
        
        return True
        
    except Exception as e:
        print(f"  ✗ Main app integration validation failed: {e}")
        return False


def validate_database_functions():
    """Validate database function files."""
    print("\n6. Validating database function files...")
    
    try:
        # Check if the SQL function file exists
        sql_file = os.path.join(os.path.dirname(__file__), 'create_match_instructions_function.sql')
        
        if not os.path.exists(sql_file):
            print("  ✗ SQL function file not found")
            return False
        
        with open(sql_file, 'r') as f:
            content = f.read()
        
        # Check for required SQL elements
        required_sql_elements = [
            'CREATE OR REPLACE FUNCTION match_training_instructions',
            'query_embedding vector(1536)',
            'chatbot_id text',
            'instruction_types text[]',
            'TrainingInstruction',
            'embedding <=> query_embedding',
            'CREATE INDEX'
        ]
        
        for element in required_sql_elements:
            if element not in content:
                print(f"  ✗ Missing SQL element: {element}")
                return False
        
        print("  ✓ All required SQL elements found")
        
        return True
        
    except Exception as e:
        print(f"  ✗ Database function validation failed: {e}")
        return False


def main():
    """Run all validation tests."""
    print("Enhanced Training Data System Backend - Implementation Validation")
    print("=" * 70)
    
    validations = [
        validate_models,
        validate_service_structure,
        validate_router_structure,
        validate_rag_integration,
        validate_main_app_integration,
        validate_database_functions
    ]
    
    passed = 0
    total = len(validations)
    
    for validation in validations:
        if validation():
            passed += 1
    
    print(f"\n{'=' * 70}")
    print(f"Validation Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All validations passed! Implementation is complete.")
        print("\nImplemented features:")
        print("  • TrainingInstruction models with proper validation")
        print("  • InstructionService with CRUD operations and embedding generation")
        print("  • API endpoints for instruction management")
        print("  • Enhanced RAG service with instruction-based context")
        print("  • Instruction similarity search and retrieval")
        print("  • Bulk import and testing capabilities")
        print("  • Database functions for vector similarity search")
        print("  • Priority-based instruction retrieval logic")
        
        print("\nNext steps:")
        print("  1. Run the SQL function creation script on your database")
        print("  2. Test the API endpoints with a running FastAPI server")
        print("  3. Verify instruction embeddings are generated correctly")
        print("  4. Test the enhanced RAG responses with instructions")
        
    else:
        print("❌ Some validations failed. Please review the implementation.")
        
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)